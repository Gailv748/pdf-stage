/* PDF 展台 —— 仿希沃视频展台界面的 PDF 阅读器
 * 纯前端实现：pdf.js 渲染 + SVG 批注 + pdf-lib 导出
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var CFG = {
    storeKey: 'pdfstage.v1',
    maxZoom: 6,
    minZoom: 0.2,
    exportScale: 2,
    penColors: ['#e53935', '#1a1a1a', '#1565c0', '#2e7d32', '#f9a825'],
    penWidths: [2, 4, 7],
    toolbarReserve: 78
  };

  var state = {
    doc: null,          // {key,name,size,numPages,pdf,bytes}
    page: 1,
    mode: 'move',
    zoom: null,         // null = 自动适应
    fitMode: 'page',    // page | width
    compare: false,
    focus: 'A',
    pen: { color: CFG.penColors[0], width: CFG.penWidths[1] },
    filter: { bright: 1, contrast: 1, sat: 1, warm: false },
    immersed: false,
    marks: []           // 书签页码
  };

  /* ------------------------------------------------------------------ */
  /* 工具函数                                                            */
  /* ------------------------------------------------------------------ */
  function $(s) { return document.querySelector(s); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1900);
  }

  function busy(on, txt) {
    var b = $('#busy');
    if (txt) $('#busyT').textContent = txt;
    b.hidden = !on;
  }

  function bytesToBase64(bytes) {
    var bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function baseName(name) { return String(name || 'document').replace(/\.pdf$/i, ''); }

  /* 保存文件：桌面/浏览器走下载，安卓走原生桥 */
  function saveBlob(name, blob) {
    var bridge = window.PDFStageBridge;
    if (bridge && bridge.saveFileBase64) {
      try {
        var reader = new FileReader();
        reader.onload = function () {
          var s = String(reader.result);
          var b64 = s.substring(s.indexOf(',') + 1);
          bridge.saveFileBase64(name, blob.type || 'application/octet-stream', b64);
        };
        reader.readAsDataURL(blob);
        return;
      } catch (e) { /* fallthrough */ }
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadBytes(name, bytes, mime) {
    saveBlob(name, new Blob([bytes], { type: mime || 'application/octet-stream' }));
  }

  /* ------------------------------------------------------------------ */
  /* 本地存储：批注 / 书签                                                */
  /* ------------------------------------------------------------------ */
  var store = {
    all: function () {
      try { return JSON.parse(localStorage.getItem(CFG.storeKey) || '{}'); }
      catch (e) { return {}; }
    },
    get: function (key) {
      var d = this.all()[key];
      return d || { strokes: {}, marks: [] };
    },
    set: function (key, rec) {
      try {
        var all = this.all();
        all[key] = rec;
        localStorage.setItem(CFG.storeKey, JSON.stringify(all));
        return true;
      } catch (e) {
        toast('本地存储空间不足，批注未保存');
        return false;
      }
    },
    remove: function (key) {
      try { var all = this.all(); delete all[key]; localStorage.setItem(CFG.storeKey, JSON.stringify(all)); }
      catch (e) { }
    }
  };

  var rec = { strokes: {}, history: {} };

  function strokesOf(page) {
    if (!rec.strokes[page]) rec.strokes[page] = [];
    return rec.strokes[page];
  }

  var saveTimer = null;
  function persist(immediate) {
    if (!state.doc) return;
    clearTimeout(saveTimer);
    var run = function () {
      store.set(state.doc.key, { strokes: rec.strokes, marks: state.marks, name: state.doc.name, ts: Date.now() });
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 500);
  }

  /* ------------------------------------------------------------------ */
  /* 页面（Pane）                                                        */
  /* ------------------------------------------------------------------ */
  function Pane(letter) {
    this.letter = letter;
    this.el = document.getElementById('pane' + letter);
    this.sheet = document.getElementById('sheet' + letter);
    this.canvas = document.getElementById('canvas' + letter);
    this.ink = document.getElementById('ink' + letter);
    this.pageNo = 1;
    this.scale = 1;
    this.pageW = 0;
    this.pageH = 0;
    this.token = 0;
    this.slideDir = 0;      // 翻页入场方向：1 下一页 / -1 上一页
    this._ptrs = {};
    this.pdfPage = null;
    this.el.dataset.mode = state.mode;
    this.sheet.style.display = 'none';   // 无文档时不占位，避免空状态出现白块
    this.bind();
  }

  Pane.prototype.bind = function () {
    var self = this;
    this.el.addEventListener('pointerdown', function () { setFocus(self.letter); });

    /* 拖拽：横向滑动翻页（仿图片浏览），纵向拖动平移 */
    var pan = null;
    this.el.addEventListener('pointerdown', function (e) {
      if (state.mode !== 'move' || e.button !== 0) return;
      self._ptrs[e.pointerId] = true;
      // 双指缩放时不参与滑动翻页
      if (Object.keys(self._ptrs).length > 1) { pan = null; return; }
      pan = { x: e.clientX, y: e.clientY, l: self.el.scrollLeft, t: self.el.scrollTop,
              id: e.pointerId, axis: null, dx: 0 };
      try { self.el.setPointerCapture(e.pointerId); } catch (err) { }
    });
    this.el.addEventListener('pointermove', function (e) {
      if (!pan || pan.id !== e.pointerId || !state.doc) return;
      var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        pan.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
        if (pan.axis === 'y') self.el.classList.add('panning');
      }
      if (pan.axis === 'x') {
        pan.dx = dx;
        var pno = self.pageNo || 1;
        var edge = (pno <= 1 && dx > 0) || (pno >= state.doc.numPages && dx < 0);
        var shift = clamp(dx * (edge ? 0.28 : 0.85), -120, 120);
        self.sheet.style.transition = 'none';
        self.sheet.style.transform = 'translateX(' + shift + 'px)';
        self.sheet.style.opacity = String(1 - Math.min(0.35, Math.abs(shift) / 340));
        return;
      }
      self.el.scrollLeft = pan.l - dx;
      self.el.scrollTop = pan.t - dy;
    });
    var settle = function (anim) {
      self.sheet.style.transition = anim ? 'transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s' : '';
      self.sheet.style.transform = '';
      self.sheet.style.opacity = '';
      if (anim) setTimeout(function () { self.sheet.style.transition = ''; }, 240);
    };
    var endPan = function (e) {
      if (e && e.pointerId != null) delete self._ptrs[e.pointerId];
      if (!pan) return;
      if (e && pan.id !== e.pointerId) return;
      var p = pan; pan = null;
      self.el.classList.remove('panning');
      if (p.axis !== 'x') return;
      var thr = Math.min(96, Math.max(46, self.el.clientWidth * 0.17));
      if (Math.abs(p.dx) >= thr) {
        settle(false);
        turnPage(p.dx < 0 ? 1 : -1);
      } else {
        settle(true);
      }
    };
    this.el.addEventListener('pointerup', endPan);
    this.el.addEventListener('pointercancel', endPan);

    /* 滚轮：Ctrl 缩放，边缘翻页 */
    var turnLock = 0;
    this.el.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((state.zoom || self.scale) * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
        return;
      }
      if (state.immersed) return;
      if (Math.abs(e.deltaY) < 2) return;
      var now = Date.now();
      if (now < turnLock) return;
      var top = self.el.scrollTop <= 0;
      var bottom = self.el.scrollTop + self.el.clientHeight >= self.el.scrollHeight - 2;
      if ((e.deltaY > 0 && bottom) || (e.deltaY < 0 && top)) {
        turnLock = now + 620;
        turnPage(e.deltaY > 0 ? 1 : -1);
      }
    }, { passive: false });

    /* 双指缩放 */
    var pinch = null;
    this.el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2) { pinch = null; return; }
      var a = e.touches[0], b = e.touches[1];
      pinch = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale: state.zoom || self.scale,
        cx: (a.clientX + b.clientX) / 2,
        cy: (a.clientY + b.clientY) / 2
      };
    }, { passive: true });
    this.el.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var a = e.touches[0], b = e.touches[1];
      var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setZoom(pinch.scale * (d / pinch.dist), pinch.cx, pinch.cy, true);
    }, { passive: false });
    this.el.addEventListener('touchend', function (e) {
      if (e.touches.length < 2 && pinch) {
        pinch = null;
        setZoom(state.zoom || self.scale, 0, 0, false);
      }
    }, { passive: true });

    /* 双击：适应页面 / 100% */
    this.el.addEventListener('dblclick', function (e) {
      if (state.mode !== 'move') return;
      if (state.zoom) { state.zoom = null; } else { state.zoom = 1; }
      render();
    });

    /* 批注 / 橡皮：监听整块窗格，因此可以画到页面外的空白处 */
    this.ink.style.pointerEvents = 'none';
    this.el.addEventListener('pointerdown', function (e) {
      if (state.mode === 'pen' || state.mode === 'eraser') self.inkDown(e);
    });
    this.el.addEventListener('pointermove', function (e) { self.inkMove(e); });
    this.el.addEventListener('pointerup', function (e) { self.inkUp(e); });
    this.el.addEventListener('pointercancel', function (e) { self.inkUp(e); });
    this.el.addEventListener('lostpointercapture', function (e) {
      if (self._drawing || self._erasing) self.inkUp(e);
    });
    this.el.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && !self._erasing) hideEraserCursor();
    });
  };

  Pane.prototype.setPage = function (n) {
    this.pageNo = clamp(n, 1, state.doc ? state.doc.numPages : 1);
    return this.render();
  };

  Pane.prototype.fitScale = function (w, h) {
    var pad = 26;
    var cw = Math.max(80, this.el.clientWidth - pad * 2);
    var ch = Math.max(80, this.el.clientHeight - pad * 2 - (state.immersed ? 0 : CFG.toolbarReserve));
    var sx = cw / w, sy = ch / h;
    return state.fitMode === 'width' ? sx : Math.min(sx, sy);
  };

  Pane.prototype.render = function () {
    var self = this;
    var token = ++this.token;
    if (!state.doc) return Promise.resolve();
    // 串行化：上一次渲染未结束时先取消，避免 canvas 被并发占用
    if (this.renderTask) {
      try { this.renderTask.cancel(); } catch (e) { }
      this.renderTask = null;
    }
    var prev = this._chain || Promise.resolve();
    var run = prev.then(function () { return self._doRender(token); });
    this._chain = run.catch(function () { });
    return run;
  };

  Pane.prototype._doRender = function (token) {
    var self = this;
    if (!state.doc || token !== this.token) return Promise.resolve();
    return state.doc.pdf.getPage(this.pageNo).then(function (page) {
      if (token !== self.token) return;
      self.pdfPage = page;
      var base = page.getViewport({ scale: 1 });
      self.pageW = base.width;
      self.pageH = base.height;
      var s = state.zoom || self.fitScale(base.width, base.height);
      s = clamp(s, CFG.minZoom, CFG.maxZoom);
      self.scale = s;

      var vp = page.getViewport({ scale: s });
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cv = self.canvas;
      cv.width = Math.round(vp.width * dpr);
      cv.height = Math.round(vp.height * dpr);
      cv.style.width = vp.width + 'px';
      cv.style.height = vp.height + 'px';
      self.sheet.style.width = vp.width + 'px';
      self.sheet.style.height = vp.height + 'px';
      self.sheet.style.display = 'block';

      self.ink.setAttribute('viewBox', '0 0 ' + base.width + ' ' + base.height);
      self.ink.setAttribute('preserveAspectRatio', 'none');
      self.ink.style.width = '100%';
      self.ink.style.height = '100%';

      var ctx = cv.getContext('2d');
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.restore();

      var task = page.render({
        canvasContext: ctx,
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
        background: '#ffffff'
      });
      self.renderTask = task;
      return task.promise.then(function () {
        self.renderTask = null;
        if (token !== self.token) return;
        self.layout();
        self.renderInk();
        updatePager();
        if (self.slideDir) {
          var dir = self.slideDir;
          self.slideDir = 0;
          self.sheet.style.transition = '';
          self.sheet.style.transform = '';
          self.sheet.style.opacity = '';
          self.sheet.classList.remove('flip-next', 'flip-prev');
          void self.sheet.offsetWidth;
          self.sheet.classList.add(dir > 0 ? 'flip-next' : 'flip-prev');
          setTimeout(function () {
            self.sheet.classList.remove('flip-next', 'flip-prev');
          }, 300);
        }
      });
    }).catch(function (err) {
      self.renderTask = null;
      if (err && err.name === 'RenderingCancelledException') return;
      if (token === self.token) console.error(err);
    });
  };

  Pane.prototype.layout = function () {
    var el = this.el;
    var h = this.sheet.offsetHeight;
    var avail = el.clientHeight - (state.immersed ? 0 : CFG.toolbarReserve);
    if (h <= avail) {
      this.sheet.style.marginTop = Math.round(Math.max(16, (avail - h) / 2) + 6) + 'px';
      this.sheet.style.marginBottom = '16px';
    } else {
      this.sheet.style.marginTop = '18px';
      this.sheet.style.marginBottom = (state.immersed ? 24 : CFG.toolbarReserve + 12) + 'px';
    }
  };

  /* ---- 批注渲染 ---- */
  function pathData(pts) {
    if (pts.length < 4) return '';
    var d = 'M' + pts[0].toFixed(2) + ' ' + pts[1].toFixed(2);
    for (var i = 2; i < pts.length - 2; i += 2) {
      var mx = (pts[i] + pts[i + 2]) / 2;
      var my = (pts[i + 1] + pts[i + 3]) / 2;
      d += ' Q' + pts[i].toFixed(2) + ' ' + pts[i + 1].toFixed(2) + ' ' + mx.toFixed(2) + ' ' + my.toFixed(2);
    }
    d += ' L' + pts[pts.length - 2].toFixed(2) + ' ' + pts[pts.length - 1].toFixed(2);
    return d;
  }

  Pane.prototype.renderInk = function () {
    var list = strokesOf(this.pageNo);
    var frag = document.createDocumentFragment();
    var els = [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var p = document.createElementNS(NS, 'path');
      var d = pathData(s.pts);
      if (!d) continue;
      p.setAttribute('d', d);
      p.setAttribute('stroke', s.color);
      p.setAttribute('stroke-width', s.w);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      frag.appendChild(p);
      els.push(p);
    }
    while (this.ink.firstChild) this.ink.removeChild(this.ink.firstChild);
    this.ink.appendChild(frag);
    this._inkEls = els;
  };

  Pane.prototype.toPage = function (clientX, clientY) {
    var r = this.ink.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width * this.pageW,
      y: (clientY - r.top) / r.height * this.pageH
    };
  };

  function eraserPoint(e) {
    var y = e.clientY - (e.pointerType === 'touch' ? 46 : 0);
    return { x: clamp(e.clientX, 10, window.innerWidth - 10), y: clamp(y, 24, window.innerHeight - 24) };
  }
  function showEraserCursor(x, y) {
    var c = $('#eraserCursor');
    if (!c) return;
    c.style.left = x + 'px';
    c.style.top = y + 'px';
    c.hidden = false;
  }
  function hideEraserCursor() {
    var c = $('#eraserCursor');
    if (c) c.hidden = true;
  }

  Pane.prototype.inkDown = function (e) {
    if (!state.doc) return;
    setFocus(this.letter);
    if (state.mode === 'pen') {
      e.preventDefault();
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { }
      this._pushHistory(this.pageNo);
      var p = this.toPage(e.clientX, e.clientY);
      this._cur = { color: state.pen.color, w: state.pen.width, pts: [p.x, p.y] };
      this._drawing = true;
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('stroke', this._cur.color);
      path.setAttribute('stroke-width', this._cur.w);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      this._live = path;
      this.ink.appendChild(path);
      this._drawDirty = true;
      this._raf();
    } else if (state.mode === 'eraser') {
      e.preventDefault();
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { }
      this._erasing = true;
      this._erasedOnce = false;
      var q = eraserPoint(e);
      this._lastErase = q;
      showEraserCursor(q.x, q.y);
      this.eraseAt(q.x, q.y);
    }
  };

  Pane.prototype.inkMove = function (e) {
    if (state.mode === 'pen' && this._drawing && this._cur) {
      var p = this.toPage(e.clientX, e.clientY);
      var pts = this._cur.pts;
      var lx = pts[pts.length - 2], ly = pts[pts.length - 1];
      if (Math.hypot(p.x - lx, p.y - ly) < 1.2) return;
      pts.push(p.x, p.y);
      if (this._live) this._live.setAttribute('d', pathData(pts));
    } else if (state.mode === 'eraser') {
      var q = eraserPoint(e);
      if (e.pointerType === 'mouse') showEraserCursor(q.x, q.y);
      if (this._erasing) {
        if (this._lastErase) this.eraseAlong(this._lastErase, q);
        else this.eraseAt(q.x, q.y);
        this._lastErase = q;
      }
    }
  };

  Pane.prototype.inkUp = function (e) {
    if (this._drawing) {
      this._drawing = false;
      var st = this._cur;
      this._cur = null;
      if (this._live) { this._live.remove(); this._live = null; }
      if (st && st.pts.length >= 4) {
        strokesOf(this.pageNo).push(st);
        persist();
        updateUndoDim();
      } else if (st) {
        // 单击点：画一个点
        st.pts.push(st.pts[0] + 0.1, st.pts[1]);
        strokesOf(this.pageNo).push(st);
        persist();
      }
      this.renderInk();
    }
    if (this._erasing) {
      this._erasing = false;
      this._lastErase = null;
      hideEraserCursor();
      this.renderInk();
      persist();
    }
  };

  /* 橡皮：擦除图标经过的区域（分段裁剪，而不是整条删除） */
  Pane.prototype.eraseAlong = function (a, b) {
    if (!a) { this.eraseAt(b.x, b.y); return; }
    var rect = this.ink.getBoundingClientRect();
    if (!rect.width) return;
    var k = this.pageW / rect.width;
    var step = Math.max(2, 18 * k * 0.6);
    var dist = Math.hypot(b.x - a.x, b.y - a.y);
    var n = Math.min(60, Math.max(1, Math.ceil(dist / step)));
    var any = false;
    for (var i = 1; i <= n; i++) {
      if (this.eraseAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, true)) any = true;
    }
    if (any) { this.renderInk(); persist(); }
  };

  Pane.prototype.eraseAt = function (cx, cy, noRender) {
    var rect = this.ink.getBoundingClientRect();
    if (!rect.width) return false;
    var p = this.toPage(cx, cy);
    var R = 18 * (this.pageW / rect.width);
    var list = strokesOf(this.pageNo);
    var next = [];
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      if (!strokeNear(st, p.x, p.y, R)) { next.push(st); continue; }
      var parts = cutStroke(st, p.x, p.y, R);
      if (!parts.length) { changed = true; continue; }
      if (parts.length === 1 && parts[0].length === st.pts.length) { next.push(st); continue; }
      changed = true;
      for (var j = 0; j < parts.length; j++) next.push({ color: st.color, w: st.w, pts: parts[j] });
    }
    if (!changed) return false;
    if (!this._erasedOnce) { this._pushHistory(this.pageNo); this._erasedOnce = true; }
    rec.strokes[this.pageNo] = next;
    if (!noRender) this.renderInk();
    updateUndoDim();
    return true;
  };

  function strokeNear(st, x, y, R) {
    var p = st.pts, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (var i = 0; i < p.length; i += 2) {
      if (p[i] < minx) minx = p[i];
      if (p[i] > maxx) maxx = p[i];
      if (p[i + 1] < miny) miny = p[i + 1];
      if (p[i + 1] > maxy) maxy = p[i + 1];
    }
    return x >= minx - R && x <= maxx + R && y >= miny - R && y <= maxy + R;
  }

  /* 返回线段落在橡皮圆外的参数区间 */
  function outsideRanges(x0, y0, x1, y1, cx, cy, R) {
    var dx = x1 - x0, dy = y1 - y0;
    var a = dx * dx + dy * dy;
    var fx = x0 - cx, fy = y0 - cy;
    if (a < 1e-9) {
      return (fx * fx + fy * fy >= R * R) ? [[0, 1]] : [];
    }
    var b = 2 * (fx * dx + fy * dy);
    var c = fx * fx + fy * fy - R * R;
    var disc = b * b - 4 * a * c;
    if (disc <= 0) {
      var mx = x0 + dx * 0.5 - cx, my = y0 + dy * 0.5 - cy;
      return (mx * mx + my * my >= R * R) ? [[0, 1]] : [];
    }
    var sq = Math.sqrt(disc);
    var t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
    var out = [];
    if (t1 > 0) out.push([0, Math.min(1, t1)]);
    if (t2 < 1) out.push([Math.max(0, t2), 1]);
    return out.filter(function (r) { return r[1] - r[0] > 1e-4; });
  }

  function cutStroke(st, cx, cy, R) {
    var pts = st.pts, parts = [], cur = null;
    function add(x, y) { if (!cur) cur = [x, y]; else cur.push(x, y); }
    function flush() { if (cur && cur.length >= 4) parts.push(cur); cur = null; }
    for (var i = 0; i < pts.length - 2; i += 2) {
      var x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
      var ranges = outsideRanges(x0, y0, x1, y1, cx, cy, R);
      if (!ranges.length) { flush(); continue; }
      for (var j = 0; j < ranges.length; j++) {
        var ta = ranges[j][0], tb = ranges[j][1];
        if (ta > 1e-4) flush();
        if (!cur) add(x0 + (x1 - x0) * ta, y0 + (y1 - y0) * ta);
        add(x0 + (x1 - x0) * tb, y0 + (y1 - y0) * tb);
        if (tb < 1 - 1e-4) flush();
      }
    }
    flush();
    return parts;
  }

  Pane.prototype._pushHistory = function (page) {
    if (!rec.history[page]) rec.history[page] = [];
    var h = rec.history[page];
    h.push(JSON.stringify(strokesOf(page)));
    if (h.length > 40) h.shift();
  };

  Pane.prototype._raf = function () { /* 逐点直接绘制，无需 rAF */ };

  /* ------------------------------------------------------------------ */
  /* 视图控制                                                            */
  /* ------------------------------------------------------------------ */
  function focusPane() { return state.focus === 'B' ? paneB : paneA; }

  function setFocus(letter) {
    if (state.focus === letter) return;
    state.focus = letter;
    paneA.el.classList.toggle('focused', letter === 'A' && state.compare);
    paneB.el.classList.toggle('focused', letter === 'B' && state.compare);
  }

  function updateModeUI() {
    var btns = document.querySelectorAll('[data-mode]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.mode === state.mode);
    }
    paneA.el.dataset.mode = state.mode;
    paneB.el.dataset.mode = state.mode;
    // 批注层只负责显示，事件统一由窗格接收，才能画到页面外的空白处
    paneA.ink.style.pointerEvents = 'none';
    paneB.ink.style.pointerEvents = 'none';
  }

  function setMode(m) {
    state.mode = m;
    if (m !== 'pen') closePop();
    updateModeUI();
    if (m === 'pen') showPenPop();
    if (m === 'eraser') showEraseBar(); else hideEraseBar();
    if (m !== 'eraser') hideEraserCursor();
  }

  /* ---------------- 橡皮：右滑清空全部批注 ---------------- */
  var eraseDrag = null;

  function setEraseProgress(p) {
    var bar = $('#erasebar'), th = $('#ebThumb');
    if (!bar) return;
    p = clamp(p, 0, 1);
    var max = Math.max(1, (bar.clientWidth || 360) - 12 - 34);
    bar.style.setProperty('--p', p.toFixed(3));
    bar.style.setProperty('--w', (34 + p * max).toFixed(1) + 'px');
    th.style.transform = 'translateX(' + (p * max).toFixed(1) + 'px)';
    bar.classList.toggle('armed', p >= 0.82);
  }

  function showEraseBar() {
    var bar = $('#erasebar');
    if (!bar) return;
    bar.hidden = false;
    positionEraseBar();
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
    setEraseProgress(0);
  }

  /* 悬浮在「橡皮」按钮正上方（工具条换行时以整条工具条顶部为基准，避免压住图标） */
  function positionEraseBar() {
    var bar = $('#erasebar');
    var btn = document.querySelector('#barMain .tbtn[data-mode=eraser]');
    var main = document.getElementById('barMain');
    var zoom = document.getElementById('zoombar');
    if (!bar || bar.hidden || !btn) return;
    var r = btn.getBoundingClientRect();
    var w = bar.offsetWidth || 360;
    var h = bar.offsetHeight || 46;
    var anchorTop = r.top;
    if (main) anchorTop = Math.min(anchorTop, main.getBoundingClientRect().top);
    // 避开底部居中的缩放条，否则滑动条会压住缩放按钮
    if (zoom && zoom.offsetHeight) anchorTop = Math.min(anchorTop, zoom.getBoundingClientRect().top);
    var left = clamp(r.left + r.width / 2 - w / 2, 8, Math.max(8, window.innerWidth - w - 8));
    var top = Math.max(8, anchorTop - h - 10);
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
  }

  function hideEraseBar() {
    var bar = $('#erasebar');
    if (!bar) return;
    bar.hidden = true;
    bar.classList.remove('armed');
    eraseDrag = null;
    setEraseProgress(0);
  }

  function eraseAllStrokes() {
    var pages = Object.keys(rec.strokes);
    var total = 0;
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], list = rec.strokes[p];
      if (!list || !list.length) continue;
      if (!rec.history[p]) rec.history[p] = [];
      rec.history[p].push(JSON.stringify(list));
      if (rec.history[p].length > 40) rec.history[p].shift();
      total += list.length;
      rec.strokes[p] = [];
    }
    hideEraseBar();
    setMode('move');
    if (!total) { toast('没有可擦除的批注'); return; }
    persist(true);
    paneA.renderInk();
    paneB.renderInk();
    updateUndoDim();
    toast('已擦除 ' + total + ' 条批注');
  }

  (function bindEraseBar() {
    var bar = $('#erasebar');
    if (!bar) return;
    bar.addEventListener('pointerdown', function (e) {
      if (bar.hidden) return;
      e.preventDefault();
      eraseDrag = { x: e.clientX, p: 0, id: e.pointerId };
      bar.classList.add('dragging');
      var th = $('#ebThumb');
      th.style.transition = 'none';
      try { bar.setPointerCapture(e.pointerId); } catch (err) { }
    });
    bar.addEventListener('pointermove', function (e) {
      if (!eraseDrag || e.pointerId !== eraseDrag.id) return;
      var max = Math.max(1, bar.clientWidth - 12 - 34);
      setEraseProgress((e.clientX - eraseDrag.x) / max);
    });
    function end(e) {
      if (!eraseDrag || (e && e.pointerId !== eraseDrag.id)) return;
      var p = eraseDrag.p;
      eraseDrag = null;
      bar.classList.remove('dragging');
      var cur = bar.classList.contains('armed') ? 1 : 0;
      if (cur >= 1) { eraseAllStrokes(); return; }
      // 没滑到底：回弹并收起，避免长期遮挡页面
      var th = $('#ebThumb');
      th.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
      setEraseProgress(0);
      setTimeout(function () {
        th.style.transition = '';
        if (!eraseDrag) hideEraseBar();
      }, 190);
    }
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('lostpointercapture', end);
  })();

  /* 工具条换行后高度会变化：同步底部预留与右下角控件位置 */
  function updateBarReserve() {
    var m = document.getElementById('barMain');
    var r = document.getElementById('barRight');
    var h = Math.max(m ? m.offsetHeight : 0, r ? r.offsetHeight : 0);
    var bottom = m ? (parseFloat(getComputedStyle(m).bottom) || 0) : 0;
    CFG.toolbarReserve = Math.max(54, Math.round(h + bottom + 8));
    document.documentElement.style.setProperty('--bar-h', Math.round(h) + 'px');
  }

  var zoomTimer = null;
  function setZoom(z, cx, cy, silent) {
    if (!state.doc) return;
    var next = clamp(z, CFG.minZoom, CFG.maxZoom);
    state.zoom = Math.round(next * 1000) / 1000;
    updatePager();
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(function () { render(); }, silent ? 80 : 20);
  }

  function render() {
    if (!state.doc) return;
    updatePager();
    paneA.setPage(state.page);
    if (state.compare) paneB.setPage(state.page + 1);
  }

  function updatePager() {
    $('#pageNow').textContent = state.doc ? state.page : '-';
    $('#pageAll').textContent = state.doc ? state.doc.numPages : '-';
    var z = state.zoom || (paneA.scale > 0 ? paneA.scale : 1);
    $('#zoomTxt').textContent = state.doc ? Math.round(z * 100) + '%' : '-';
    var last = state.doc ? (state.compare ? state.doc.numPages - 1 : state.doc.numPages) : 1;
    $('#prevPage').disabled = !state.doc || state.page <= 1;
    $('#nextPage').disabled = !state.doc || state.page >= last;
  }

  function turnPage(d) {
    if (!state.doc) return;
    var max = state.doc.numPages;
    var n = clamp(state.page + d, 1, max);
    var maxStart = state.compare ? max - 1 : max;
    n = clamp(n, 1, Math.max(1, maxStart));
    if (n === state.page) return;
    state.page = n;
    paneA.slideDir = d;
    paneB.slideDir = d;
    paneA.el.scrollTop = 0;
    paneB.el.scrollTop = 0;
    render();
    updateBookmarkUI();
    if (drawerOpen && drawerTab === 'thumbs') markThumb();
  }

  function gotoPage(n) {
    if (!state.doc) return;
    var d = clamp(n, 1, state.doc.numPages) >= state.page ? 1 : -1;
    paneA.slideDir = d;
    paneB.slideDir = d;
    state.page = clamp(n, 1, state.doc.numPages);
    paneA.el.scrollTop = 0;
    paneB.el.scrollTop = 0;
    render();
    updateBookmarkUI();
    if (drawerOpen && drawerTab === 'thumbs') markThumb();
  }

  /* ------------------------------------------------------------------ */
  /* 打开文档                                                            */
  /* ------------------------------------------------------------------ */
  function openArrayBuffer(buf, name, size) {
    if (!buf || !buf.byteLength) { toast('文件为空'); return; }
    busy(true, '正在解析 PDF…');
    var task = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      cMapUrl: 'vendor/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'vendor/standard_fonts/'
    });
    task.promise.then(function (pdf) {
      state.doc = {
        key: 'd|' + name + '|' + size + '|' + pdf.numPages,
        name: name,
        size: size,
        numPages: pdf.numPages,
        pdf: pdf
      };
      var saved = store.get(state.doc.key);
      rec = { strokes: saved.strokes || {}, history: {} };
      state.marks = saved.marks || [];
      state.page = 1;
      state.compare = false;
      state.zoom = null;
      paneA.slideDir = 0;
      paneB.slideDir = 0;
      paneB.el.hidden = true;
      document.body.classList.remove('no-doc', 'compare');
      var cmpBtn = document.querySelector('[data-act=compare]');
      if (cmpBtn) cmpBtn.classList.remove('active');
      $('#empty').hidden = true;
      document.title = baseName(name) + ' · PDF 展台';
      updateBookmarkUI();
      render();
      busy(false);
      toast('已打开：' + name + '（' + pdf.numPages + ' 页）');
    }).catch(function (err) {
      busy(false);
      console.error(err);
      toast('打开失败：文件可能已损坏或被加密');
    });
  }

  function openFile(file) {
    if (!file) return;
    var n = file.name || 'document.pdf';
    if (!/\.pdf$/i.test(n) && file.type !== 'application/pdf') {
      toast('请选择 PDF 文件');
      return;
    }
    var fr = new FileReader();
    fr.onload = function () { openArrayBuffer(fr.result, n, file.size); };
    fr.onerror = function () { toast('读取文件失败'); };
    fr.readAsArrayBuffer(file);
  }

  /* ------------------------------------------------------------------ */
  /* 工具条动作                                                          */
  /* ------------------------------------------------------------------ */
  function act(name) {
    switch (name) {
      case 'menu': showMenuPop(); break;
      case 'minimize': doMinimize(); break;
      case 'open': $('#fileInput').click(); break;
      case 'bookmark': toggleBookmark(); break;
      case 'undo': undo(); break;
      case 'shot': shot(); break;
      case 'export': exportPdf(); break;
      case 'thumbs': openDrawer('thumbs'); break;
      case 'lamp': toggleWarm(); break;
      case 'adjust': showAdjustPop(); break;
      case 'settings': showSettingsPop(); break;
      case 'immerse': toggleImmerse(); break;
      case 'compare': toggleCompare(); break;
      case 'save': doSave(); break;
    }
  }

  function doMinimize() {
    var b = window.PDFStageBridge;
    if (b && b.minimize) { b.minimize(); return; }
    toast('当前环境不支持窗口最小化');
  }

  function doSave() {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    persist(true);
    toast('批注与书签已保存到本机');
  }

  function toggleWarm() {
    state.filter.warm = !state.filter.warm;
    applyFilter();
    toast(state.filter.warm ? '护眼模式已开启' : '护眼模式已关闭');
  }

  function applyFilter() {
    var f = state.filter;
    var css = 'brightness(' + f.bright + ') contrast(' + f.contrast + ') saturate(' + f.sat + ')';
    if (f.warm) css += ' sepia(.22)';
    var panes = [paneA.sheet, paneB.sheet];
    for (var i = 0; i < panes.length; i++) panes[i].style.filter = css;
  }

  function toggleImmerse() {
    state.immersed = !state.immersed;
    document.body.classList.toggle('immersed', state.immersed);
    var ic = $('#immerseIc');
    ic.style.transform = state.immersed ? 'rotate(180deg)' : 'none';
    setTimeout(function () {
      if (state.doc) { paneA.layout(); paneA.render(); if (state.compare) paneB.render(); }
    }, 230);
  }

  function toggleCompare() {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    if (state.doc.numPages < 2) { toast('文档只有 1 页，无法双页对比'); return; }
    state.compare = !state.compare;
    if (state.compare) {
      state.page = Math.min(state.page, state.doc.numPages - 1);
      paneB.el.hidden = false;
      paneA.el.classList.add('focused');
      state.focus = 'A';
      render();
      toast('对比教学：左页 ' + state.page + ' / 右页 ' + (state.page + 1));
    } else {
      paneB.el.hidden = true;
      paneA.el.classList.remove('focused');
      paneB.el.classList.remove('focused');
      state.focus = 'A';
      render();
    }
    document.body.classList.toggle('compare', state.compare);
    document.querySelector('[data-act=compare]').classList.toggle('active', state.compare);
    updatePager();
  }

  function undo() {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    var p = focusPane().pageNo;
    var h = rec.history[p];
    if (!h || !h.length) { toast('没有可撤销的操作'); return; }
    rec.strokes[p] = JSON.parse(h.pop());
    focusPane().renderInk();
    persist();
    updateUndoDim();
    toast('已撤销');
  }

  function updateUndoDim() {
    var b = document.querySelector('[data-act=undo]');
    var h = rec.history[focusPane().pageNo];
    b.classList.toggle('dim', !(h && h.length));
  }

  /* ------------------------------------------------------------------ */
  /* 截图 / 导出                                                         */
  /* ------------------------------------------------------------------ */
  function shot() {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    var pane = focusPane();
    busy(true, '正在生成截图…');
    setTimeout(function () {
      var s = 2;
      var cv = document.createElement('canvas');
      cv.width = Math.round(pane.pageW * s);
      cv.height = Math.round(pane.pageH * s);
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      pane.pdfPage.render({ canvasContext: ctx, viewport: pane.pdfPage.getViewport({ scale: s }) }).promise.then(function () {
        drawStrokes(ctx, strokesOf(pane.pageNo), s);
        cv.toBlob(function (blob) {
          saveBlob(baseName(state.doc.name) + '-P' + pad2(pane.pageNo) + '.png', blob);
          busy(false);
          toast('截图已保存');
        }, 'image/png');
      });
    }, 30);
  }

  function drawStrokes(ctx, list, s) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < list.length; i++) {
      var st = list[i], pts = st.pts;
      if (pts.length < 4) continue;
      ctx.beginPath();
      ctx.strokeStyle = st.color;
      ctx.lineWidth = Math.max(1, st.w * s * 0.62);
      ctx.moveTo(pts[0] * s, pts[1] * s);
      for (var j = 2; j < pts.length - 2; j += 2) {
        var mx = (pts[j] + pts[j + 2]) / 2 * s;
        var my = (pts[j + 1] + pts[j + 3]) / 2 * s;
        ctx.quadraticCurveTo(pts[j] * s, pts[j + 1] * s, mx, my);
      }
      ctx.lineTo(pts[pts.length - 2] * s, pts[pts.length - 1] * s);
      ctx.stroke();
    }
  }

  function exportPdf() {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    if (!window.PDFLib) { toast('导出组件未加载'); return; }
    var doc = state.doc;
    var total = doc.numPages;
    busy(true, '正在导出 1/' + total);
    var out, i = 1;

    PDFLib.PDFDocument.create().then(function (pdfDoc) {
      out = pdfDoc;
      var step = function () {
        if (i > total) return finish();
        return doc.pdf.getPage(i).then(function (page) {
          var s = CFG.exportScale;
          var base = page.getViewport({ scale: 1 });
          var vp = page.getViewport({ scale: s });
          var cv = document.createElement('canvas');
          cv.width = Math.round(vp.width);
          cv.height = Math.round(vp.height);
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cv.width, cv.height);
          return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
            drawStrokes(ctx, strokesOf(i), s);
            var data = cv.toDataURL('image/jpeg', 0.92);
            cv.width = cv.height = 0;
            var b64 = data.split(',')[1];
            var bin = atob(b64);
            var arr = new Uint8Array(bin.length);
            for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
            return out.embedJpg(arr).then(function (img) {
              var pg = out.addPage([base.width, base.height]);
              pg.drawImage(img, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() });
              try { page.cleanup(); } catch (e) { }
              i++;
              $('#busyT').textContent = '正在导出 ' + Math.min(i - 1, total) + '/' + total;
              return step();
            });
          });
        });
      };
      function finish() {
        out.save().then(function (bytes) {
          downloadBytes(baseName(doc.name) + '-批注版.pdf', bytes, 'application/pdf');
          busy(false);
          toast('已导出 ' + total + ' 页（含批注）');
        }).catch(function (e) {
          console.error(e);
          busy(false);
          toast('导出失败：' + e.message);
        });
      }
      step();
    }).catch(function (e) {
      busy(false);
      toast('导出失败：' + e.message);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 书签                                                                */
  /* ------------------------------------------------------------------ */
  function toggleBookmark() {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    var p = state.page;
    var i = state.marks.indexOf(p);
    if (i >= 0) { state.marks.splice(i, 1); toast('已取消书签 P' + p); }
    else { state.marks.push(p); state.marks.sort(function (a, b) { return a - b; }); toast('已添加书签 P' + p); }
    persist();
    updateBookmarkUI();
    if (drawerOpen && drawerTab === 'marks') renderMarks();
  }

  function updateBookmarkUI() {
    var btn = document.querySelector('[data-act=bookmark]');
    btn.classList.toggle('active', state.marks.indexOf(state.page) >= 0);
  }

  /* ------------------------------------------------------------------ */
  /* 浮层                                                                */
  /* ------------------------------------------------------------------ */
  var popFor = null;

  function closePop() {
    $('#pop').hidden = true;
    popFor = null;
  }

  function placePop(el, anchor) {
    var pop = $('#pop');
    pop.hidden = false;
    var place = function () {
      var r = anchor.getBoundingClientRect();
      var w = pop.offsetWidth, h = pop.offsetHeight;
      var left = clamp(r.left + r.width / 2 - w / 2, 10, Math.max(10, window.innerWidth - w - 10));
      var top = r.top - h - 10;
      if (top < 8) top = r.bottom + 10;
      top = clamp(top, 8, Math.max(8, window.innerHeight - h - 8));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    };
    place();
    requestAnimationFrame(place);
  }

  function showPenPop() {
    if (popFor === 'pen') { closePop(); return; }
    var pop = $('#pop');
    var colors = CFG.penColors.map(function (c) {
      return '<span class="sw' + (c === state.pen.color ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>';
    }).join('');
    var widths = CFG.penWidths.map(function (w) {
      return '<button data-width="' + w + '" class="' + (w === state.pen.width ? 'on' : '') + '">' + (w === 2 ? '细' : w === 4 ? '中' : '粗') + '</button>';
    }).join('');
    pop.innerHTML =
      '<div class="po-title">批注颜色</div><div class="swatches">' + colors + '</div>' +
      '<div class="po-title">笔迹粗细</div><div class="po-seg">' + widths + '</div>' +
      '<div class="po-item" data-pop="clearPage"><svg class="ic"><use xlink:href="#i-trash"/></svg>清除本页批注</div>';
    popFor = 'pen';
    placePop(pop, document.querySelector('[data-mode=pen]'));
    pop.querySelectorAll('.sw').forEach(function (el) {
      el.onclick = function () {
        state.pen.color = el.dataset.color;
        pop.querySelectorAll('.sw').forEach(function (x) { x.classList.remove('on'); });
        el.classList.add('on');
      };
    });
    pop.querySelectorAll('[data-width]').forEach(function (el) {
      el.onclick = function () {
        state.pen.width = +el.dataset.width;
        pop.querySelectorAll('[data-width]').forEach(function (x) { x.classList.remove('on'); });
        el.classList.add('on');
      };
    });
    pop.querySelector('[data-pop=clearPage]').onclick = function () {
      if (!state.doc) return;
      var p = focusPane().pageNo;
      focusPane()._pushHistory(p);
      rec.strokes[p] = [];
      focusPane().renderInk();
      persist();
      toast('已清除本页批注');
    };
  }

  function showMenuPop() {
    if (popFor === 'menu') { closePop(); return; }
    var pop = $('#pop');
    pop.innerHTML =
      '<div class="po-title">文件</div>' +
      '<div class="po-item" data-pop="open"><svg class="ic"><use xlink:href="#i-open"/></svg>打开 PDF<span class="k">Ctrl+O</span></div>' +
      '<div class="po-item" data-pop="thumbs"><svg class="ic"><use xlink:href="#i-scan"/></svg>页面缩略图</div>' +
      '<div class="po-item" data-pop="marks"><svg class="ic"><use xlink:href="#i-bookmark"/></svg>书签<span class="k">B</span></div>' +
      '<div class="po-sep"></div>' +
      '<div class="po-item" data-pop="clearAll"><svg class="ic"><use xlink:href="#i-trash"/></svg>清除全部批注</div>' +
      '<div class="po-item" data-pop="keys"><svg class="ic"><use xlink:href="#i-gear"/></svg>快捷键</div>' +
      '<div class="po-item" data-pop="about"><svg class="ic"><use xlink:href="#i-file"/></svg>关于 PDF 展台</div>';
    popFor = 'menu';
    placePop(pop, document.querySelector('[data-act=menu]'));
    pop.querySelectorAll('.po-item').forEach(function (el) {
      el.onclick = function () {
        var k = el.dataset.pop;
        closePop();
        if (k === 'open') $('#fileInput').click();
        if (k === 'thumbs') openDrawer('thumbs');
        if (k === 'marks') openDrawer('marks');
        if (k === 'clearAll') clearAll();
        if (k === 'keys') showKeys();
        if (k === 'about') showAbout();
      };
    });
  }

  function clearAll() {
    if (!state.doc) return;
    rec.strokes = {};
    rec.history = {};
    paneA.renderInk();
    paneB.renderInk();
    persist(true);
    toast('已清除全部批注');
  }

  function showKeys() {
    var pop = $('#pop');
    pop.innerHTML =
      '<div class="po-title">快捷键</div>' +
      '<div class="po-item">Ctrl+O<span class="k">打开文件</span></div>' +
      '<div class="po-item">← / →<span class="k">上一页 / 下一页</span></div>' +
      '<div class="po-item">+ / -<span class="k">放大 / 缩小</span></div>' +
      '<div class="po-item">V / P / E<span class="k">移动 / 批注 / 橡皮</span></div>' +
      '<div class="po-item">Ctrl+Z<span class="k">撤销</span></div>' +
      '<div class="po-item">Ctrl+S<span class="k">保存批注</span></div>' +
      '<div class="po-item">Esc<span class="k">退出展开 / 关闭浮层</span></div>';
    popFor = 'keys';
    placePop(pop, document.querySelector('[data-act=menu]'));
  }

  function showAbout() {
    var pop = $('#pop');
    pop.innerHTML =
      '<div class="po-title">PDF 展台 v1.0</div>' +
      '<div class="po-item" style="cursor:default;color:#666;line-height:1.7;display:block">' +
      '仿希沃视频展台界面的 PDF 阅读与批注工具。<br>支持批注、橡皮、撤销、双页对比、护眼、截图与带批注导出。</div>';
    popFor = 'about';
    placePop(pop, document.querySelector('[data-act=menu]'));
  }

  function showAdjustPop() {
    if (popFor === 'adjust') { closePop(); return; }
    var f = state.filter;
    var pop = $('#pop');
    pop.innerHTML =
      '<div class="po-title">画面调节</div>' +
      row('bright', '亮度', 50, 150, Math.round(f.bright * 100)) +
      row('contrast', '对比度', 50, 150, Math.round(f.contrast * 100)) +
      row('sat', '饱和度', 0, 200, Math.round(f.sat * 100)) +
      '<div class="po-toggle" data-pop="reset"><span>恢复默认</span><span style="color:#2f9bff">重置</span></div>';
    popFor = 'adjust';
    placePop(pop, document.querySelector('[data-act=adjust]'));
    pop.querySelectorAll('input[type=range]').forEach(function (inp) {
      inp.oninput = function () {
        var v = +inp.value / 100;
        state.filter[inp.dataset.f] = v;
        inp.parentNode.querySelector('.val').textContent = inp.value + '%';
        applyFilter();
      };
    });
    pop.querySelector('[data-pop=reset]').onclick = function () {
      state.filter.bright = 1; state.filter.contrast = 1; state.filter.sat = 1;
      state.filter.warm = false;
      applyFilter();
      closePop();
    };

    function row(field, label, min, max, val) {
      return '<div class="po-row"><label>' + label + '</label><input type="range" data-f="' + field + '" min="' + min + '" max="' + max + '" value="' + val + '"><span class="val">' + val + '%</span></div>';
    }
  }

  function showSettingsPop() {
    if (popFor === 'settings') { closePop(); return; }
    var pop = $('#pop');
    pop.innerHTML =
      '<div class="po-title">显示</div>' +
      '<div class="po-seg"><button data-fit="page" class="' + (state.fitMode === 'page' ? 'on' : '') + '">适应页面</button>' +
      '<button data-fit="width" class="' + (state.fitMode === 'width' ? 'on' : '') + '">适应宽度</button></div>' +
      '<div class="po-toggle" data-pop="warm"><span>护眼暖色</span><span class="switch ' + (state.filter.warm ? 'on' : '') + '"></span></div>' +
      '<div class="po-toggle" data-pop="autoSave"><span>自动保存批注</span><span class="switch on"></span></div>' +
      '<div class="po-sep"></div>' +
      '<div class="po-title">双页对比</div>' +
      '<div class="po-toggle" data-pop="compare"><span>左右并排显示相邻两页</span><span class="switch ' + (state.compare ? 'on' : '') + '"></span></div>' +
      '<div class="po-sep"></div>' +
      '<div class="po-item" data-pop="about"><svg class="ic"><use xlink:href="#i-file"/></svg>关于 / 版本信息</div>';
    popFor = 'settings';
    placePop(pop, document.querySelector('[data-act=settings]'));
    pop.querySelectorAll('[data-fit]').forEach(function (el) {
      el.onclick = function () {
        state.fitMode = el.dataset.fit;
        state.zoom = null;
        pop.querySelectorAll('[data-fit]').forEach(function (x) { x.classList.remove('on'); });
        el.classList.add('on');
        render();
      };
    });
    pop.querySelector('[data-pop=warm]').onclick = function (e) {
      state.filter.warm = !state.filter.warm;
      e.currentTarget.querySelector('.switch').classList.toggle('on', state.filter.warm);
      applyFilter();
    };
    pop.querySelector('[data-pop=compare]').onclick = function (e) {
      toggleCompare();
      e.currentTarget.querySelector('.switch').classList.toggle('on', state.compare);
    };
    pop.querySelector('[data-pop=about]').onclick = function () { closePop(); showAbout(); };
  }

  /* ------------------------------------------------------------------ */
  /* 抽屉：缩略图 / 书签                                                 */
  /* ------------------------------------------------------------------ */
  var drawerOpen = false, drawerTab = 'thumbs', thumbJob = 0, thumbIO = null;

  function openDrawer(tab) {
    if (!state.doc) { toast('请先打开 PDF'); return; }
    if (drawerOpen && drawerTab === tab) { closeDrawer(); return; }
    drawerOpen = true;
    drawerTab = tab;
    $('#drawer').hidden = false;
    document.querySelectorAll('.dtab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    if (tab === 'thumbs') renderThumbs(); else renderMarks();
  }

  function closeDrawer() {
    drawerOpen = false;
    $('#drawer').hidden = true;
    thumbJob++;
    if (thumbIO) { thumbIO.disconnect(); thumbIO = null; }
  }

  function renderThumbs() {
    var body = $('#drawerBody');
    body.innerHTML = '';
    var job = ++thumbJob;
    if (thumbIO) { thumbIO.disconnect(); thumbIO = null; }
    var total = state.doc.numPages;
    var pdf = state.doc.pdf;
    var width = 168;
    // 按当前页面长宽比预估占位高度，滚动条不会因为图片陆续加载而跳动
    var ratio = (paneA.pageW && paneA.pageH) ? paneA.pageH / paneA.pageW : 0.75;
    var boxH = Math.max(34, Math.round(width * ratio));

    function addThumb(n) {
      var d = document.createElement('div');
      d.className = 'thumb' + (n === state.page ? ' on' : '');
      d.dataset.page = n;
      d.style.minHeight = boxH + 'px';
      d.innerHTML = '<span class="no">' + n + '</span>';
      d.onclick = function () { gotoPage(n); markThumb(); };
      d._load = function () {
        if (d._done || job !== thumbJob) return;
        d._done = true;
        pdf.getPage(n).then(function (page) {
          if (job !== thumbJob) return;
          var vp = page.getViewport({ scale: 1 });
          var s = width / vp.width;
          var v2 = page.getViewport({ scale: s });
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(v2.width));
          cv.height = Math.max(1, Math.round(v2.height));
          d.style.minHeight = '';
          d.insertBefore(cv, d.firstChild);
          page.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise.catch(function () { });
        }).catch(function () { });
      };
      return d;
    }

    // 128 页大文档：只为可视区域附近的缩略图分配 canvas
    var canObserve = 'IntersectionObserver' in window;
    if (canObserve) {
      thumbIO = new IntersectionObserver(function (ents) {
        for (var k = 0; k < ents.length; k++) {
          if (ents[k].isIntersecting) {
            var t = ents[k].target;
            thumbIO.unobserve(t);
            if (t._load) t._load();
          }
        }
      }, { root: body, rootMargin: '400px 0px' });
    }

    var frag = document.createDocumentFragment();
    for (var n = 1; n <= total; n++) frag.appendChild(addThumb(n));
    body.appendChild(frag);

    if (canObserve) {
      for (var t = 0; t < body.children.length; t++) thumbIO.observe(body.children[t]);
    } else {
      for (var q = 0; q < body.children.length; q++) body.children[q]._load();
    }

    if (state.page > 12) setTimeout(markThumb, 60);
  }

  function markThumb() {
    var list = $('#drawerBody').querySelectorAll('.thumb');
    for (var i = 0; i < list.length; i++) {
      var on = +list[i].dataset.page === state.page;
      list[i].classList.toggle('on', on);
      if (on && list[i].scrollIntoView) {
        list[i].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function renderMarks() {
    var body = $('#drawerBody');
    body.innerHTML = '';
    if (!state.marks.length) {
      body.innerHTML = '<div style="color:#888;font-size:12px;padding:14px 6px;line-height:1.8">还没有书签。<br>阅读时点击左下「书签」即可标记当前页。</div>';
      return;
    }
    state.marks.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'mark';
      d.innerHTML = '<svg class="ic"><use xlink:href="#i-bookmark"/></svg><span>第 ' + p + ' 页</span>' +
        '<span class="del" title="删除"><svg class="ic" style="width:13px;height:13px"><use xlink:href="#i-close"/></svg></span>';
      d.onclick = function (e) {
        if (e.target.closest('.del')) {
          state.marks = state.marks.filter(function (x) { return x !== p; });
          persist();
          updateBookmarkUI();
          renderMarks();
          return;
        }
        gotoPage(p);
        updateBookmarkUI();
      };
      body.appendChild(d);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 事件绑定                                                            */
  /* ------------------------------------------------------------------ */
  var paneA = new Pane('A');
  var paneB = new Pane('B');

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (btn) { act(btn.dataset.act); return; }
    var mode = e.target.closest('[data-mode]');
    if (mode) { setMode(mode.dataset.mode); return; }
    var pop = $('#pop');
    if (!pop.hidden && !e.target.closest('#pop')) closePop();
  });

  document.querySelectorAll('.dtab').forEach(function (b) {
    b.onclick = function () {
      drawerTab = b.dataset.tab;
      document.querySelectorAll('.dtab').forEach(function (x) { x.classList.toggle('active', x === b); });
      if (drawerTab === 'thumbs') renderThumbs(); else renderMarks();
    };
  });
  $('#drawerClose').onclick = closeDrawer;

  $('#prevPage').onclick = function () { turnPage(-1); };
  $('#nextPage').onclick = function () { turnPage(1); };
  $('#zoomIn').onclick = function () { setZoom((state.zoom || paneA.scale) * 1.15, window.innerWidth / 2, window.innerHeight / 2); };
  $('#zoomOut').onclick = function () { setZoom((state.zoom || paneA.scale) * 0.87, window.innerWidth / 2, window.innerHeight / 2); };

  $('#emptyOpen').onclick = function () { $('#fileInput').click(); };
  $('#fileInput').onchange = function () { var f = this.files[0]; openFile(f); this.value = ''; };
  $('#fileInputB').onchange = function () { var f = this.files[0]; openFile(f); this.value = ''; };

  $('#reveal').onclick = function () { if (state.immersed) toggleImmerse(); };

  /* 拖放打开 */
  ['dragenter', 'dragover'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      e.preventDefault();
      document.body.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      e.preventDefault();
      if (ev === 'drop' || e.target === document.documentElement) document.body.classList.remove('dragover');
    });
  });
  window.addEventListener('drop', function (e) {
    if (e.dataTransfer.files && e.dataTransfer.files.length) openFile(e.dataTransfer.files[0]);
  });

  /* 键盘 */
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (k === 'o' || k === 'O')) { e.preventDefault(); $('#fileInput').click(); return; }
    if (mod && (k === 's' || k === 'S')) { e.preventDefault(); doSave(); return; }
    if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); undo(); return; }
    if (k === 'Escape') {
      if (state.immersed) { toggleImmerse(); return; }
      if (!$('#pop').hidden) { closePop(); return; }
      if (drawerOpen) { closeDrawer(); return; }
      if (state.mode !== 'move') { setMode('move'); return; }
      return;
    }
    if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); turnPage(-1); }
    else if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); turnPage(1); }
    else if (k === '+' || k === '=') { e.preventDefault(); $('#zoomIn').click(); }
    else if (k === '-' || k === '_') { e.preventDefault(); $('#zoomOut').click(); }
    else if (k === 'v' || k === 'V') { setMode('move'); }
    else if (k === 'p' || k === 'P') { setMode('pen'); }
    else if (k === 'e' || k === 'E') { setMode('eraser'); }
    else if (k === 'b' || k === 'B') { toggleBookmark(); }
    else if (k === 'f' || k === 'F') { toggleImmerse(); }
  });

  /* 尺寸变化 */
  var rsz = null;
  window.addEventListener('resize', function () {
    clearTimeout(rsz);
    rsz = setTimeout(function () {
      updateBarReserve();
      positionEraseBar();
      if (state.doc) render();
    }, 220);
  });

  /* 页面卸载前保存 */
  window.addEventListener('beforeunload', function () {
    if (state.doc) persist(true);
  });

  /* 主题初始化 */
  updateBarReserve();
  updateModeUI();
  updatePager();
  applyFilter();
  paneA.el.classList.toggle('focused', false);

  /* 供打包层调用：直接以字节打开 */
  window.PDFStageOpen = function (bytes, name) {
    openArrayBuffer(bytes, name || 'document.pdf', bytes.byteLength || 0);
  };

  /* 安卓 intent / 桌面命令行传入的文件（由打包层桥接） */
  (function () {
    var b = window.PDFStageBridge;
    if (!b || typeof b.readPendingFile !== 'function') return;
    setTimeout(function () {
      try {
        var b64 = b.readPendingFile();
        if (!b64) return;
        var bin = atob(b64);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var name = (b.getPendingName && b.getPendingName()) || 'document.pdf';
        openArrayBuffer(arr.buffer, name, arr.length);
      } catch (e) { console.warn(e); }
    }, 60);
  })();

  /* pdf.js worker：http(s) 下用真正 Worker；file:// / Android asset 下
     pdf.js 会自动降级为「假 Worker」（主线程渲染），因此始终给出相对路径 */
  if (window.pdfjsLib) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    } catch (e) { }
  }

  /* 安卓返回键回调：返回 true 表示已消费 */
  window.PDFStageBack = function () {
    if (state.immersed) { toggleImmerse(); return true; }
    if (!$('#pop').hidden) { closePop(); return true; }
    if (drawerOpen) { closeDrawer(); return true; }
    if (state.mode !== 'move') { setMode('move'); return true; }
    if (state.compare) { toggleCompare(); return true; }
    return false;
  };
})();
