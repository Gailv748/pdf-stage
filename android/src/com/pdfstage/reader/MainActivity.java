package com.pdfstage.reader;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final int REQ_FILE = 1001;
    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;

    private volatile String pendingBase64 = "";
    private volatile String pendingName = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(false);
        ws.setTextZoom(100);

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = cb;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/pdf");
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择 PDF 文件"), REQ_FILE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "PDFStageBridge");
        web.loadUrl("file:///android_asset/web/index.html");
        setContentView(web);

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    /** 支持从文件管理器用「打开方式」直接送入 PDF */
    private void handleIntent(final Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        final Uri uri = intent.getData();
        if (uri == null) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    InputStream in = getContentResolver().openInputStream(uri);
                    if (in == null) return;
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                    in.close();
                    pendingBase64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                    pendingName = "document.pdf";
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (web != null) web.reload();
                        }
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null) {
                    Uri uri = data.getData();
                    if (uri != null) result = new Uri[]{uri};
                }
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web == null) { moveTaskToBack(true); return; }
        web.evaluateJavascript(
                "(window.PDFStageBack && window.PDFStageBack()) ? '1' : '0'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || value.contains("0")) {
                            moveTaskToBack(true);
                        }
                    }
                });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("PDFStageBridge");
            web.destroy();
        }
        super.onDestroy();
    }

    /* ------------------------- JS 桥 ------------------------- */
    public class Bridge {

        @JavascriptInterface
        public String readPendingFile() {
            String b64 = pendingBase64;
            pendingBase64 = "";          // 只交付一次
            return b64;
        }

        @JavascriptInterface
        public String getPendingName() {
            return pendingName == null || pendingName.isEmpty() ? "document.pdf" : pendingName;
        }

        @JavascriptInterface
        public void minimize() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { moveTaskToBack(true); }
            });
        }

        @JavascriptInterface
        public void saveFileBase64(String name, String mime, String b64) {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                String safe = sanitize(name);
                boolean ok = writeToDownloads(safe, mime, bytes);
                final String msg = ok ? ("已保存到 下载/PDF展台/" + safe) : "保存失败";
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); }
                });
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void toast(String msg) {
            final String m = msg;
            runOnUiThread(new Runnable() {
                @Override
                public void run() { Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show(); }
            });
        }
    }

    private static String sanitize(String name) {
        if (name == null || name.trim().isEmpty()) return "PDF展台-" + System.currentTimeMillis() + ".pdf";
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private boolean writeToDownloads(String name, String mime, byte[] bytes) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, mime == null ? "application/pdf" : mime);
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PDF展台");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return false;
                OutputStream out = getContentResolver().openOutputStream(uri);
                out.write(bytes);
                out.close();
                return true;
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), "PDF展台");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(bytes);
                fos.close();
                return true;
            }
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
}
