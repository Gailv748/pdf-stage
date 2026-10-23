#!/usr/bin/env bash
# 发布到 GitHub：推送源码 → 重建 gh-pages（官网）→ 创建 Release 并上传安装包 → 开启 Pages
# 用法：GH_TOKEN=xxx bash tools/publish.sh [owner/repo]
# 前置：同名空仓库必须已存在（当前授权无法调用 createRepository）
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="${1:-Gailv748/pdf-stage}"
TOKEN="${GH_TOKEN:-$(gh auth token 2>/dev/null || true)}"
[ -n "$TOKEN" ] || { echo "缺少 GH_TOKEN"; exit 1; }
[ -d release-assets ] || { echo "缺少 release-assets/，请先准备安装包"; exit 1; }

REMOTE="https://x-access-token:$TOKEN@github.com/$REPO.git"

echo "[1/4] 推送 main"
git branch -M main
git push -f "$REMOTE" main

echo "[2/4] 生成 gh-pages"
DEPLOY="$(cd .. && pwd)/pdf-stage-pages"
rm -rf "$DEPLOY"
git worktree prune
git worktree add -B gh-pages "$DEPLOY" >/dev/null
find "$DEPLOY" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a site/. "$DEPLOY"/
touch "$DEPLOY/.nojekyll"
(
  cd "$DEPLOY"
  git add -A
  git -c user.name="PDF Stage" -c user.email="pdfstage@users.noreply.github.com" \
      commit -q -m "deploy: 官网与 4K60 宣传片" || true
)
git worktree remove --force "$DEPLOY" || true
git push -f "$REMOTE" gh-pages

echo "[3/4] 创建 Release"
if gh release view v1.0.0 --repo "$REPO" >/dev/null 2>&1; then
  gh release upload v1.0.0 --repo "$REPO" release-assets/* --clobber
else
  gh release create v1.0.0 --repo "$REPO" release-assets/* \
    --title "PDF 展台 v1.0" --notes-file tools/release-notes.md
fi

echo "[4/4] 开启 GitHub Pages"
gh api -X POST "repos/$REPO/pages" \
  -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 \
  && echo "Pages 已开启" \
  || echo "Pages 需手动开启：Settings → Pages → Source 选择 gh-pages 分支"

echo "完成：https://github.com/$REPO"
echo "官网：https://${REPO%%/*}.github.io/${REPO##*/}/"
