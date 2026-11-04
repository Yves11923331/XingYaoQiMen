package com.momen.xingyaoqimen;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;

/**
 * 星曜奇门 · 正式壳（2026-10-21 方案A 转正：包名/签名与旧包一致，可覆盖安装）
 *
 * 相比原壳，本版只动壳层、不碰 web/：
 *   1. 启动画面 —— AndroidManifest 主题 windowBackground（告别冷启动白屏）
 *   2. 出错兜底 —— WebView 主页面加载失败时，显示原生错误页 + 重试按钮
 *   3. 返回键双击退出 —— 网页没处理返回时，第一次提示「再按一次退出」，第二次才退
 * 原壳的全部能力（截图存相册 / 定位 / 选图 / localStorage 兜底 / 状态栏）原样保留。
 */
public class MainActivity extends Activity {

    private static final String TAG = "XingYao";
    private static final String BG = "#FFFFFF";     // 首次启动的兜底底色（素白）
    private static final String PREFS = "xyqm";
    private static final String ALBUM = "星曜奇门";   // 相册里的子目录名
    private static final int REQ_LOC = 1001;          // 定位权限请求码
    private static final int REQ_FILE = 1002;         // 选图（<input type="file">）请求码
    private static final long DOUBLE_BACK_MS = 2000L; // 双击退出间隔
    /* ★ 启动画面节奏（2026-10-21 用户：「出现和消失都太快了」）：
       最短展示 900ms，再 280ms 淡出。页面加载再快也不会一闪而过；加载慢就继续显示。 */
    private static final long SPLASH_MIN_MS = 900L;
    private static final long SPLASH_FADE_MS = 280L;

    private WebView web;
    private FrameLayout root;
    private View errorView;                            // 原生错误页
    private View splashView;                           // 启动画面（叠在 WebView 之上）
    private long splashStart = 0L;                     // onCreate 的时刻
    private boolean splashGone = false;                // 是否已经淡出（防重复）
    private long lastBack = 0L;                        // 上次按返回键的时间
    private boolean pageFailed = false;               // 主页面是否加载失败（防止 onPageFinished 误关错误页）
    /* 定位授权是异步的：把网页那次询问攒起来，等系统权限回来再一次回答 */
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    /* ★ WebView 里 <input type="file"> **必须**由 onShowFileChooser 接管，
       否则点上去什么都不发生 —— 这正是"选图无响应"的根因。 */
    private ValueCallback<Uri[]> fileCb;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        splashStart = SystemClock.uptimeMillis();
        statusBar();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);        // ★ 必须：主题/观测点存在 localStorage
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                  // 不跟随系统字体缩放，版面才稳
        s.setGeolocationEnabled(true);       // 已废弃但仍有效：老 WebView 只看这个开关
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            /* 主页面加载失败：显示原生错误页 + 重试按钮（不再是一片空白） */
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req != null && req.isForMainFrame()) {
                    pageFailed = true;
                    String d = "";
                    try { d = err.getDescription().toString(); } catch (Throwable ignored) {}
                    showError("页面加载失败\n" + d);
                    revealSplash();                 /* 错误页要露出来，别被启动画面一直盖着 */
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!pageFailed) hideError();
                revealSplash();                     /* 加载完了：等够最短展示再淡出 */
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, "JS " + cm.message() + " @" + cm.lineNumber());
                return true;
            }

            /* ★ 网页里点 <input type="file"> 时走这里。不实现的话那个按钮就是个死的
               —— 背景图选图"无响应"就是这个原因。 */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCb != null) { fileCb.onReceiveValue(null); fileCb = null; }
                fileCb = cb;
                try {
                    Intent it = params.createIntent();
                    it.addCategory(Intent.CATEGORY_OPENABLE);
                    it.setType("image/*");
                    startActivityForResult(it, REQ_FILE);
                    return true;
                } catch (Throwable t) {
                    Log.w(TAG, "打不开选图器", t);
                    fileCb = null;
                    cb.onReceiveValue(null);
                    return false;
                }
            }

            /* ★ 没有这个方法，WebView 里的 navigator.geolocation 一定失败（连提示都不弹）。
               系统权限还没给的时候，先把网页这次询问攒下来，等 onRequestPermissionsResult
               回来再回答 —— 当场拒绝的话网页立刻收到 PERMISSION_DENIED。 */
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                                                           GeolocationPermissions.Callback cb) {
                if (hasLoc()) { cb.invoke(origin, true, false); return; }
                geoCb = cb; geoOrigin = origin;
                try {
                    requestPermissions(new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION }, REQ_LOC);
                } catch (Throwable t) {
                    cb.invoke(origin, false, false);
                    geoCb = null; geoOrigin = null;
                }
            }
        });

        int bg = bgColor();
        web.setBackgroundColor(bg);
        try { getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(bg)); } catch (Throwable ignored) {}
        /* 状态栏也跟着上次的主题走，免得深色主题下从浅色状态栏闪一下 */
        try {
            getWindow().setStatusBarColor(bg);
        } catch (Throwable ignored) {}
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "Xyqimen");

        /* WebView + 启动画面 + 原生错误页叠在同一容器里（错误页永远在最上） */
        root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        splashView = buildSplash(bg);
        root.addView(splashView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        errorView = buildErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        /* 兜底：万一 onPageFinished 一直不来（极端 WebView），4 秒后强制淡出 */
        root.postDelayed(new Runnable() {
            @Override public void run() { revealSplash(); }
        }, 4000L);

        web.loadUrl("file:///android_asset/index.html");
    }

    /** 启动画面（2026-10-21 定版「白场」）：底色 + 图标 + 字标 + 底部细进度线。
     *
     *  · 图标框 102dp 不是 88dp：splash_logo 是 480 画布、内容只占 86%（414/480），
     *    102dp 的框换算出**内容宽约 88dp**，正好等于设计稿（88px @390 基准）。
     *    以后换图标素材（裁紧版）要同步把 102 调回 88，否则会变小一圈。
     *  · 文字/线条颜色按底色亮度反色：浅色主题走深墨（白场原样），
     *    blue / slate 这类深底主题自动走浅色（等价于「夜场」），冷启动绝不白闪。
     *  · 整组上移 3.2% 屏高，对应设计稿的 translateY(-3.2vh)。
     *  · 进度线 900ms 走满，提前 80ms 起跑，正好在 SPLASH_MIN_MS 之后、淡出之前收尾。 */
    private View buildSplash(int bg) {
        boolean light = isLight(bg);
        int ink = light ? 0xFF141414 : 0xFFEDEDED;
        int ink2 = light ? 0xFF9C9C9C : 0xFF6E6E6E;
        int trackC = light ? 0xFFE6E6E3 : 0x24FFFFFF;
        int fillC = light ? 0xFF171717 : 0xFFEFEFEF;

        float d = getResources().getDisplayMetrics().density;
        FrameLayout f = new FrameLayout(this);
        if (light) {
            /* 白场：上白下暖，极浅的垂直渐变（对应设计稿 #ffffff → #f8f8f5） */
            f.setBackground(new android.graphics.drawable.GradientDrawable(
                    android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
                    new int[] {0xFFFFFFFF, 0xFFF8F8F5}));
        } else {
            f.setBackgroundColor(bg);
        }

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);

        ImageView iv = new ImageView(this);
        /* 壳的构建链不生成 R.java（旧壳从不引用资源），所以按名字取 drawable id。 */
        int logo = getResources().getIdentifier("splash_logo", "drawable", getPackageName());
        iv.setImageResource(logo != 0 ? logo : android.R.mipmap.sym_def_app_icon);
        box.addView(iv, new LinearLayout.LayoutParams((int) (102 * d), (int) (102 * d)));
        /* 第一帧只有底色（见 splash_bg.xml），所以图标也从 0 淡入 ——
           与标题(160ms)、英文(300ms)错开，整组是「浮出来」而不是「啪一下贴上」。 */
        iv.setAlpha(0f);
        iv.animate().alpha(1f).setStartDelay(40).setDuration(320).start();

        TextView title = new TextView(this);
        title.setText("星曜奇门");
        title.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 15);
        title.setTextColor(ink);
        title.setTypeface(android.graphics.Typeface.create("sans-serif-medium",
                android.graphics.Typeface.NORMAL));
        title.setLetterSpacing(0.52f);
        title.setIncludeFontPadding(false);
        /* letterSpacing 在**末字后面**也留一份间距，整行会偏左；补回半个字距才视觉居中
           （设计稿是用 text-indent 做的同一件事）。 */
        title.setPadding((int) (0.26f * 15 * d), 0, 0, 0);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tp.topMargin = (int) (54 * d);
        box.addView(title, tp);

        TextView en = new TextView(this);
        en.setText("XINGYAO QIMEN");
        en.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 8.5f);
        en.setTextColor(ink2);
        en.setTypeface(android.graphics.Typeface.create("sans-serif",
                android.graphics.Typeface.NORMAL));
        en.setLetterSpacing(0.42f);
        en.setIncludeFontPadding(false);
        en.setPadding((int) (0.21f * 8.5f * d), 0, 0, 0);
        LinearLayout.LayoutParams ep = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ep.topMargin = (int) (16 * d);
        box.addView(en, ep);

        f.addView(box, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER));
        box.setTranslationY(-0.032f * getResources().getDisplayMetrics().heightPixels);

        /* 底部进度线：轨道 72×1dp，填充从左拉到右 */
        FrameLayout prog = new FrameLayout(this);
        View track = new View(this);
        track.setBackgroundColor(trackC);
        View bar = new View(this);
        bar.setBackgroundColor(fillC);
        prog.addView(track, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        prog.addView(bar, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(
                (int) (72 * d), Math.max(1, (int) (1 * d)),
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        pp.bottomMargin = (int) (64 * d);
        f.addView(prog, pp);
        bar.setPivotX(0f);
        bar.setScaleX(0f);
        bar.animate().scaleX(1f).setStartDelay(80).setDuration(900)
                .setInterpolator(new android.view.animation.PathInterpolator(
                        0.32f, 0.72f, 0.24f, 1f))
                .start();

        /* 字标晚半拍淡入：启动画面不是一张死图，有呼吸感 */
        title.setAlpha(0f);
        en.setAlpha(0f);
        title.animate().alpha(1f).setStartDelay(160).setDuration(380).start();
        en.animate().alpha(1f).setStartDelay(300).setDuration(380).start();
        return f;
    }

    /** 底色是否偏亮（启动页文字/线条据此反色） */
    private static boolean isLight(int c) {
        int r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
        return (r * 299 + g * 587 + b * 114) / 1000 >= 158;
    }

    /** 至少展示 SPLASH_MIN_MS 再淡出；加载失败也走这里（露出错误页） */
    private void revealSplash() {
        if (splashView == null || splashGone) return;
        splashGone = true;
        long wait = Math.max(0, SPLASH_MIN_MS - (SystemClock.uptimeMillis() - splashStart));
        splashView.postDelayed(new Runnable() {
            @Override
            public void run() {
                final View v = splashView;
                if (v == null) return;
                v.animate().alpha(0f).setDuration(SPLASH_FADE_MS).withEndAction(new Runnable() {
                    @Override
                    public void run() {
                        try { root.removeView(v); } catch (Throwable ignored) {}
                        splashView = null;
                    }
                }).start();
            }
        }, wait);
    }

    /** 原生错误页（纯代码构建，不引布局文件） */
    private View buildErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        int pad = (int) (60 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad, pad, pad);
        box.setBackgroundColor(Color.WHITE);

        TextView tv = new TextView(this);
        tv.setTextColor(Color.parseColor("#333333"));
        tv.setTextSize(15);
        tv.setGravity(Gravity.CENTER);
        tv.setText("页面加载失败");

        Button btn = new Button(this);
        btn.setText("重试");
        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pageFailed = false;
                hideError();
                if (web != null) web.loadUrl("file:///android_asset/index.html");
            }
        });

        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bp.topMargin = 30;
        box.addView(tv);
        box.addView(btn, bp);
        return box;
    }

    private void showError(String msg) {
        if (errorView == null) return;
        try {
            ((TextView) ((ViewGroup) errorView).getChildAt(0)).setText(msg);
        } catch (Throwable ignored) {}
        errorView.setVisibility(View.VISIBLE);
        if (web != null) web.setVisibility(View.GONE);
    }

    private void hideError() {
        if (errorView == null) return;
        errorView.setVisibility(View.GONE);
        if (web != null) web.setVisibility(View.VISIBLE);
    }

    /** 有没有定位权限（细/粗任一即可） */
    private boolean hasLoc() {
        if (Build.VERSION.SDK_INT < 23) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                   == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                   == PackageManager.PERMISSION_GRANTED;
    }

    /** 系统权限弹窗结果：无论允许与否都要回答网页那次的询问，否则网页会一直等 */
    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != REQ_LOC) return;
        boolean ok = false;
        for (int i = 0; i < res.length; i++) {
            if (res[i] == PackageManager.PERMISSION_GRANTED) { ok = true; break; }
        }
        if (geoCb != null) { geoCb.invoke(geoOrigin, ok, false); geoCb = null; geoOrigin = null; }
        Log.d(TAG, "定位权限结果: " + ok);
    }

    /** 选图回来了：把结果交回网页。没选就回 null（网页那边会当成取消） */
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != REQ_FILE) { super.onActivityResult(req, res, data); return; }
        if (fileCb == null) return;
        Uri[] out = null;
        if (res == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                out = new Uri[n];
                for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                out = new Uri[] { data.getData() };
            }
        }
        fileCb.onReceiveValue(out);
        fileCb = null;
    }

    /** 上次用过的壳底色（网页侧 applyTheme 会写进来）。取不到就用兜底。 */
    private int bgColor() {
        try {
            String s = getSharedPreferences(PREFS, MODE_PRIVATE).getString("shellBg", null);
            if (s != null && s.length() == 7 && s.charAt(0) == '#') return Color.parseColor(s);
        } catch (Throwable ignored) {}
        try { return Color.parseColor(BG); } catch (Throwable t) { return 0xFFFFFFFF; }
    }

    /** 系统栏透明 + edge-to-edge：壁纸才能铺满整屏（否则状态栏/手势条是纯色，底部留白）。
        图标颜色仍按主题明暗切换，失败也不影响使用。 */
    private void statusBar() {
        try {
            int bg = bgColor();
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            /* edge-to-edge：内容延伸到状态栏/导航栏后面 */
            if (Build.VERSION.SDK_INT >= 30) {
                getWindow().setDecorFitsSystemWindows(false);
            } else {
                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
            }
            /* 系统栏透明，透出网页壁纸 */
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            View dv = getWindow().getDecorView();
            int flags = dv.getSystemUiVisibility();
            /* 底色浅 → 系统栏图标用深色；底色深 → 用浅色。写死深色图标的话，
               玄夜主题下状态栏会是"深底深字"，看不见。 */
            int lum = (int) (0.299 * Color.red(bg) + 0.587 * Color.green(bg) + 0.114 * Color.blue(bg));
            if (Build.VERSION.SDK_INT >= 23) {
                if (lum > 140) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                else flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) {
                    if (lum > 140) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    else flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            }
            dv.setSystemUiVisibility(flags);
        } catch (Throwable t) {
            Log.w(TAG, "状态栏设置失败", t);
        }
    }

    /** 返回键：先让网页关浮层 / 退回主页；网页没处理时，双击才退出（防误触） */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (web != null) {
                web.evaluateJavascript(
                    "(function(){try{return (window.xyqimenBack&&window.xyqimenBack())?1:0}catch(e){return 0}})()",
                    new ValueCallback<String>() {
                        @Override public void onReceiveValue(String v) {
                            if ("1".equals(v)) return;          // 网页已处理
                            long now = System.currentTimeMillis();
                            if (now - lastBack < DOUBLE_BACK_MS) {
                                finish();                       // 已提示过，退出
                            } else {
                                lastBack = now;
                                Toast.makeText(MainActivity.this, "再按一次退出", Toast.LENGTH_SHORT).show();
                            }
                        }
                    });
            } else {
                finish();
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("Xyqimen");
            ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** 给网页的原生口子 */
    private class Bridge {

        @JavascriptInterface
        public String appVersion() { return "2.0.2-a"; }

        @JavascriptInterface
        public String shell() { return "xingyaoqimen-standalone"; }

        /* 物理屏尺寸（含状态栏/导航栏的完整屏），返回 "宽x高" 像素。
           全面屏壁纸要按这个比例裁 —— 网页的 innerWidth/innerHeight 不含系统栏，
           全面屏下会矮成"非全面屏"比例。getRealMetrics 从 API 17 就有了，SDK 29 稳。 */
        @JavascriptInterface
        public String screenSize() {
            try {
                android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
                getWindowManager().getDefaultDisplay().getRealMetrics(dm);
                return dm.widthPixels + "x" + dm.heightPixels;
            } catch (Throwable t) {
                return "";
            }
        }

        /* 网页切主题时把底色存下来：下次启动 WebView 与窗口就按这个铺底，
           否则深色主题会从写死的素白闪一下。 */
        @JavascriptInterface
        public void setShellBg(String color) {
            try {
                if (color == null || color.length() != 7 || color.charAt(0) != '#') return;
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("shellBg", color).apply();
            } catch (Throwable ignored) {}
        }

        /* 设置持久化的兜底通道。
           理论上 file:// + setDomStorageEnabled(true) 就能用 localStorage，
           但各厂商 WebView 对 file:// 源的处理不完全一致；网页侧只在 localStorage
           不可用时才走这里，所以是纯保险，不影响正常路径。 */
        @JavascriptInterface
        public String lsGet(String k) {
            try { return getSharedPreferences("xyqm", MODE_PRIVATE).getString(k, null); }
            catch (Throwable t) { return null; }
        }

        @JavascriptInterface
        public void lsSet(String k, String v) {
            try { getSharedPreferences("xyqm", MODE_PRIVATE).edit().putString(k, v).apply(); }
            catch (Throwable t) { }
        }

        /**
         * 定位兜底：网页的 navigator.geolocation 拿不到时走这里。
         * 只读「最后已知位置」—— 不主动发起定位（省电、也不会有长时间等待），
         * 返回 "OK:纬度,经度" 或 "ERR:原因"。
         */
        @JavascriptInterface
        public String locate() {
            try {
                LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
                if (lm == null) return "ERR:no-service";
                String[] provs = { LocationManager.GPS_PROVIDER,
                                   LocationManager.NETWORK_PROVIDER,
                                   LocationManager.PASSIVE_PROVIDER };
                Location best = null;
                for (int i = 0; i < provs.length; i++) {
                    try {
                        Location l = lm.getLastKnownLocation(provs[i]);
                        if (l == null) continue;
                        if (best == null || l.getTime() > best.getTime()) best = l;
                    } catch (Throwable ignored) { }
                }
                if (best == null) return "ERR:no-fix";
                return "OK:" + best.getLatitude() + "," + best.getLongitude();
            } catch (Throwable t) {
                return "ERR:" + t.getClass().getSimpleName();
            }
        }

        /**
         * 截图存相册。dataUrl 形如 "data:image/png;base64,...."。
         * 走 MediaStore 写 Pictures/星曜奇门/ —— API 29+ 不需要任何权限，也不会触发存储弹窗。
         * 返回 "OK:<uri>" 或 "ERR:<原因>"。
         */
        @JavascriptInterface
        public String saveImage(String dataUrl, String name) {
            OutputStream os = null;
            try {
                if (dataUrl == null) return "ERR:empty";
                String b64 = dataUrl;
                int comma = b64.indexOf(',');
                if (comma >= 0) b64 = b64.substring(comma + 1);
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                if (bytes == null || bytes.length == 0) return "ERR:decode";

                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
                if (Build.VERSION.SDK_INT >= 29) {
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/" + ALBUM);
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                }
                Uri uri = getContentResolver().insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return "ERR:insert";

                os = getContentResolver().openOutputStream(uri);
                if (os == null) return "ERR:stream";
                os.write(bytes);
                os.flush();
                os.close();
                os = null;

                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContentResolver().update(uri, done, null, null);
                }
                Log.d(TAG, "已存相册: " + uri);
                return "OK:" + uri;
            } catch (Throwable t) {
                Log.w(TAG, "存图失败", t);
                return "ERR:" + (t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage());
            } finally {
                try { if (os != null) os.close(); } catch (Throwable ignored) {}
            }
        }
    }
}
