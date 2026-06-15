/* ============================================
   メディア圧縮ツール : media.js
   - モード切替（画像 / 動画 / 音声）
   - 動画・音声は同梱の ffmpeg.wasm（単一スレッド版）で端末内処理
   - ffmpeg本体は重い（約25MB）ため遅延ロード:
     動画/音声モードで初めて圧縮を実行した時に ffmpeg.load() する
   - メディアデータは外部に送信・保存しない
   外部依存: window.FFmpeg（vendor/ffmpeg/ffmpeg.min.js が提供するUMDグローバル）
   ============================================ */

(function () {
  "use strict";

  /* ---------- ffmpeg 遅延ロード管理 ----------
     注意: 単一スレッド版(core-st)のEmscriptenランタイムは、1回 run() すると
     EXIT_RUNTIME により終了する。同じインスタンスで2回目を run() すると
     "Program terminated with exit(0)" で失敗する。
     そのため「圧縮1回ごとに新しいインスタンスを load() する」方針とする。
     wasm本体(約24MB)はブラウザのHTTPキャッシュに載るため、2回目以降の load() は
     ネットワーク取得を伴わず比較的高速。初回ロードかどうかだけ everLoaded で覚え、
     UX（プログレス文言）に使う。 */
  let everLoaded = false; // これまでに一度でも load() を完了したか（初回判定用）

  // 単一スレッド版のローカルcoreを指す。外部CDNには取りに行かない。
  // 注意: @ffmpeg/ffmpeg@0.11.6 は corePath が相対パスだと内部で
  // `new URL(corePath, "file:///home/jeromewu/...")` という固定baseに対して解決し、
  // file:// URL になって fetch に失敗する。これを避けるため絶対URLへ解決して渡す。
  const CORE_PATH = new URL(
    "./vendor/ffmpeg/ffmpeg-core.js",
    document.baseURI || window.location.href
  ).href;

  function getFFmpegFactory() {
    // UMD: window.FFmpeg.createFFmpeg / fetchFile
    return (typeof window !== "undefined" && window.FFmpeg) ? window.FFmpeg : null;
  }

  // 進捗コールバックを差し替えられるよう、現在処理中のハンドラを保持
  let currentProgressHandler = null;

  // 圧縮1回ごとに呼ぶ: 新しいインスタンスを生成して load() する。
  async function createLoadedFFmpeg() {
    const factory = getFFmpegFactory();
    if (!factory || typeof factory.createFFmpeg !== "function") {
      throw new Error("ffmpeg.wasm の読み込みに失敗しました（vendorファイル未配置の可能性）");
    }
    const ffmpeg = factory.createFFmpeg({
      // 単一スレッド版(core-st)のローカルcoreを使用。CLIエントリ名(main)は
      // 同梱の ffmpeg.min.js 側でフォールバックを 'main' にパッチ済み
      // （詳細は vendor/ffmpeg/README.md）。
      corePath: CORE_PATH,
      log: false,
      // 進捗は ratio コールバックで受け取り、現在のハンドラへ委譲
      progress: ({ ratio }) => {
        if (currentProgressHandler && typeof ratio === "number") {
          currentProgressHandler(ratio);
        }
      },
    });
    await ffmpeg.load();
    everLoaded = true;
    return ffmpeg;
  }

  function fetchFile(input) {
    const factory = getFFmpegFactory();
    return factory.fetchFile(input);
  }

  /* ---------- モード切替 ---------- */
  function initModeTabs() {
    const tabs = Array.from(document.querySelectorAll(".mode-tab"));
    const panels = {
      image: document.getElementById("panel-image"),
      video: document.getElementById("panel-video"),
      audio: document.getElementById("panel-audio"),
    };
    if (!tabs.length || !panels.image) return;

    function activate(mode) {
      tabs.forEach((t) => {
        const on = t.dataset.mode === mode;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      Object.keys(panels).forEach((key) => {
        if (panels[key]) panels[key].hidden = key !== mode;
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activate(tab.dataset.mode));
    });
    activate("image");
  }

  /* ---------- 共通ユーティリティ ---------- */
  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function buildOutName(originalName, ext) {
    const dot = originalName.lastIndexOf(".");
    const base = dot > 0 ? originalName.slice(0, dot) : originalName;
    return `${base}.compressed.${ext}`;
  }

  function safeInputName(originalName, fallbackExt) {
    // ffmpeg FS 用に安全なASCII名へ。拡張子は入力判定に使われるので極力残す。
    const dot = originalName.lastIndexOf(".");
    const ext = dot > 0 ? originalName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : fallbackExt;
    return `input.${ext || fallbackExt}`;
  }

  /* ============================================
     メディア（動画/音声）圧縮コントローラ
     画像モードと干渉しないよう独立した状態を持つ
     ============================================ */
  function createMediaController(config) {
    // config: { kind:'video'|'audio', ids..., buildArgs(fn), outExt, outMime }
    const dom = {
      dropZone: document.getElementById(config.dropZoneId),
      input: document.getElementById(config.inputId),
      compressBtn: document.getElementById(config.compressBtnId),
      clearBtn: document.getElementById(config.clearBtnId),
      progressWrap: document.getElementById(config.progressWrapId),
      progressFill: document.getElementById(config.progressFillId),
      progressLabel: document.getElementById(config.progressLabelId),
      statusText: document.getElementById(config.statusTextId),
      resultList: document.getElementById(config.resultListId),
      template: document.getElementById("media-result-item-template"),
    };

    // 必須要素が無いページでは何もしない
    if (!dom.dropZone || !dom.input || !dom.compressBtn) return;

    const local = {
      file: null,
      originalUrl: null,
      resultUrl: null,
      busy: false,
    };

    function setStatus(text) {
      if (dom.statusText) dom.statusText.textContent = text;
    }

    function showProgress(show) {
      if (dom.progressWrap) dom.progressWrap.hidden = !show;
    }

    function setProgress(ratio, label) {
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      if (dom.progressFill) dom.progressFill.style.width = `${pct}%`;
      if (dom.progressLabel) dom.progressLabel.textContent = label || `${pct}%`;
    }

    function setFile(file) {
      if (local.originalUrl) URL.revokeObjectURL(local.originalUrl);
      local.file = file;
      local.originalUrl = URL.createObjectURL(file);
      dom.compressBtn.disabled = false;
      dom.clearBtn.disabled = false;
      setStatus(`選択中: ${file.name}（${formatSize(file.size)}）`);
      dom.resultList.innerHTML = "";
    }

    function clearAll() {
      if (local.busy) return;
      if (local.originalUrl) URL.revokeObjectURL(local.originalUrl);
      if (local.resultUrl) URL.revokeObjectURL(local.resultUrl);
      local.file = null;
      local.originalUrl = null;
      local.resultUrl = null;
      dom.compressBtn.disabled = true;
      dom.clearBtn.disabled = true;
      dom.resultList.innerHTML = "";
      showProgress(false);
      setProgress(0, "");
      setStatus("");
    }

    function renderResult(originalSize, resultBlob, resultName) {
      dom.resultList.innerHTML = "";
      const frag = dom.template.content.cloneNode(true);
      const nameEl = frag.querySelector(".result-item__name");
      const beforeEl = frag.querySelector(".result-item__before");
      const afterEl = frag.querySelector(".result-item__after");
      const ratioEl = frag.querySelector(".result-item__ratio");
      const statusEl = frag.querySelector(".result-item__status");
      const dl = frag.querySelector(".result-item__download");

      if (local.resultUrl) URL.revokeObjectURL(local.resultUrl);
      local.resultUrl = URL.createObjectURL(resultBlob);

      const reduction = originalSize > 0
        ? Math.round((1 - resultBlob.size / originalSize) * 100)
        : 0;

      nameEl.textContent = resultName;
      beforeEl.textContent = `元: ${formatSize(originalSize)}`;
      afterEl.textContent = `圧縮後: ${formatSize(resultBlob.size)}`;
      ratioEl.textContent = reduction > 0
        ? `（${reduction}%削減）`
        : reduction < 0
          ? `（${Math.abs(reduction)}%増加）`
          : "（変化なし）";
      statusEl.textContent = "完了";
      dl.href = local.resultUrl;
      dl.download = resultName;

      dom.resultList.appendChild(frag);
    }

    async function runCompress() {
      if (local.busy || !local.file) return;
      local.busy = true;
      dom.compressBtn.disabled = true;
      dom.clearBtn.disabled = true;
      dom.resultList.innerHTML = "";

      const inName = safeInputName(local.file.name, config.kind === "video" ? "mp4" : "mp3");
      const outName = `output.${config.outExt}`;
      let ffmpeg;

      try {
        // --- 遅延ロード ---
        // 単一スレッド版は run() が一度きりのため、毎回 新規インスタンスを load() する。
        showProgress(true);
        setProgress(0, everLoaded
          ? "圧縮エンジンを準備中…"
          : "圧縮エンジンを読み込み中…（初回のみ・約25MB）");
        setStatus("処理中です。ファイルが大きいほど時間がかかります。");
        ffmpeg = await createLoadedFFmpeg();

        // --- 進捗ハンドラを差し替え ---
        currentProgressHandler = (ratio) => {
          setProgress(ratio, `圧縮中… ${Math.round(ratio * 100)}%`);
        };

        setProgress(0, "圧縮中… 0%");

        // --- 入力をFSへ書き込み ---
        ffmpeg.FS("writeFile", inName, await fetchFile(local.file));

        // --- コーデック引数 ---
        const args = config.buildArgs(inName, outName);
        await ffmpeg.run(...args);

        // --- 出力読み出し ---
        const data = ffmpeg.FS("readFile", outName);
        const blob = new Blob([data.buffer], { type: config.outMime });
        const resultName = buildOutName(local.file.name, config.outExt);

        // --- 後始末（メモリ解放） ---
        try { ffmpeg.FS("unlink", inName); } catch (e) { /* ignore */ }
        try { ffmpeg.FS("unlink", outName); } catch (e) { /* ignore */ }
        // インスタンス自体を破棄してwasmメモリを解放（GC対象にする）
        try { if (typeof ffmpeg.exit === "function") ffmpeg.exit(); } catch (e) { /* ignore */ }

        setProgress(1, "完了");
        renderResult(local.file.size, blob, resultName);
        setStatus("圧縮が完了しました。");
      } catch (err) {
        showProgress(false);
        setStatus(`圧縮に失敗しました: ${(err && err.message) ? err.message : err}`);
      } finally {
        currentProgressHandler = null;
        ffmpeg = null;
        local.busy = false;
        dom.compressBtn.disabled = !local.file;
        dom.clearBtn.disabled = !local.file;
      }
    }

    /* ---------- イベント登録 ---------- */
    dom.dropZone.addEventListener("click", () => dom.input.click());
    dom.dropZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dom.input.click();
      }
    });
    dom.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dom.dropZone.classList.add("drop-zone--active");
    });
    dom.dropZone.addEventListener("dragleave", () => {
      dom.dropZone.classList.remove("drop-zone--active");
    });
    dom.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dom.dropZone.classList.remove("drop-zone--active");
      const f = Array.from(e.dataTransfer.files || []).find((file) =>
        file.type.startsWith(config.kind + "/")
      );
      if (f) setFile(f);
    });
    dom.input.addEventListener("change", () => {
      const f = (dom.input.files && dom.input.files[0]) || null;
      if (f) setFile(f);
      dom.input.value = "";
    });
    dom.compressBtn.addEventListener("click", runCompress);
    dom.clearBtn.addEventListener("click", clearAll);
  }

  /* ---------- 動画コントローラ ---------- */
  function initVideo() {
    const resolutionSel = document.getElementById("video-resolution");
    const qualitySel = document.getElementById("video-quality");

    createMediaController({
      kind: "video",
      dropZoneId: "video-drop-zone",
      inputId: "video-input",
      compressBtnId: "video-compress-btn",
      clearBtnId: "video-clear-btn",
      progressWrapId: "video-progress-wrap",
      progressFillId: "video-progress-fill",
      progressLabelId: "video-progress-label",
      statusTextId: "video-status-text",
      resultListId: "video-result-list",
      outExt: "mp4",
      outMime: "video/mp4",
      buildArgs: (inName, outName) => {
        const crf = (qualitySel && qualitySel.value) ? qualitySel.value : "30";
        const maxH = resolutionSel ? Number(resolutionSel.value) : 0;
        const args = ["-i", inName, "-c:v", "libx264", "-preset", "veryfast", "-crf", crf];
        if (maxH > 0) {
          // 高さを上限に縮小（拡大はしない）。幅は偶数に丸める（H.264要件）。
          args.push("-vf", `scale=-2:'min(${maxH},ih)'`);
        }
        // 音声はAACへ。音声トラックが無い場合でも問題なし。
        args.push("-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outName);
        return args;
      },
    });
  }

  /* ---------- 音声コントローラ ---------- */
  function initAudio() {
    const bitrateSel = document.getElementById("audio-bitrate");

    createMediaController({
      kind: "audio",
      dropZoneId: "audio-drop-zone",
      inputId: "audio-input",
      compressBtnId: "audio-compress-btn",
      clearBtnId: "audio-clear-btn",
      progressWrapId: "audio-progress-wrap",
      progressFillId: "audio-progress-fill",
      progressLabelId: "audio-progress-label",
      statusTextId: "audio-status-text",
      resultListId: "audio-result-list",
      outExt: "mp3",
      outMime: "audio/mpeg",
      buildArgs: (inName, outName) => {
        const kbps = (bitrateSel && bitrateSel.value) ? bitrateSel.value : "96";
        return ["-i", inName, "-vn", "-c:a", "libmp3lame", "-b:a", `${kbps}k`, outName];
      },
    });
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initModeTabs();
    initVideo();
    initAudio();
  });
})();
