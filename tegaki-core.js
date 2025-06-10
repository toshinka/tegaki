// tegaki-core.js
// 二次裏用手書きブックマークレット

(function() {
    // 既にツールバーが存在するかチェック
    if (document.getElementById("tegakiToolbar")) {
        console.log("二次裏手書きツールは既に起動しています。");
        alert("二次裏手書きツールは既に起動しています。");
        return; // 既に起動している場合は処理を中断
    }

    // 既存の手書きキャンバス要素を取得
    const tegakiCanvas = document.getElementById("oejs");

    // 手書きキャンバスが存在しない場合
    if (!tegakiCanvas) {
        alert("手書きキャンバスが見つかりません！先に手書きモードを開いてください。");
        console.log("手書きキャンバスが見つかりません！先に手書きモードを開いてください。");
        return; // 処理を中断
    }

    // キャンバスのコンテキストを取得
    const ctx = tegakiCanvas.getContext("2d");

    // 各種設定
    let penSize = 5; // ペンサイズ
    let penColor = "#000000"; // ペン色 (黒)

    // === ツールバーの作成 ===
    const toolbar = document.createElement("div");
    toolbar.id = "tegakiToolbar"; // IDを設定
    toolbar.style.position = "absolute";
    toolbar.style.top = "10px";
    toolbar.style.right = "10px";
    toolbar.style.zIndex = "9999";
    toolbar.style.background = "rgba(255,255,255,0.8)";
    toolbar.style.border = "1px solid #ccc";
    toolbar.style.padding = "10px";
    toolbar.style.borderRadius = "5px";
    document.body.appendChild(toolbar);

    // [ペンサイズ]
    const penSizeInput = document.createElement("input");
    penSizeInput.type = "range";
    penSizeInput.min = "1";
    penSizeInput.max = "50";
    penSizeInput.value = penSize;
    penSizeInput.oninput = (e) => {
        penSize = parseInt(e.target.value);
    };
    toolbar.appendChild(document.createTextNode("ペンサイズ: "));
    toolbar.appendChild(penSizeInput);
    toolbar.appendChild(document.createElement("br"));

    // [ペン色]
    const penColorInput = document.createElement("input");
    penColorInput.type = "color";
    penColorInput.value = penColor;
    penColorInput.oninput = (e) => {
        penColor = e.target.value;
    };
    toolbar.appendChild(document.createTextNode("ペン色: "));
    toolbar.appendChild(penColorInput);
    toolbar.appendChild(document.createElement("br"));

    // [消しゴム]
    const eraserButton = document.createElement("button");
    eraserButton.textContent = "消しゴム";
    eraserButton.onclick = () => {
        penColor = "#FFFFFF"; // 白に設定
    };
    toolbar.appendChild(eraserButton);

    // [クリア]
    const clearButton = document.createElement("button");
    clearButton.textContent = "クリア";
    clearButton.onclick = () => {
        ctx.clearRect(0, 0, tegakiCanvas.width, tegakiCanvas.height);
    };
    toolbar.appendChild(clearButton);
    toolbar.appendChild(document.createElement("br"));

    // [画像を転写]
    const transferButton = document.createElement("button");
    transferButton.textContent = "画像を転写";
    transferButton.onclick = () => {
        // キャンバスの内容をData URLとして取得
        const imageDataURL = tegakiCanvas.toDataURL("image/png");
        // ここでふたばちゃんねるの投稿フォームの手書き.js入力欄にData URLをセットする処理を実装
        // 例: document.querySelector('textarea[name="js"]').value = imageDataURL;
        // 実際のセレクタは環境によって異なる可能性があります
        const jsField = document.querySelector('textarea[name="js"]'); // ふたばの手書き.js欄を想定
        if (jsField) {
            jsField.value = imageDataURL;
            alert("画像を手書き.js欄に転写しました！");
        } else {
            alert("手書き.js欄が見つかりませんでした。");
        }
    };
    toolbar.appendChild(transferButton);

    // === 描画処理 ===
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function draw(e) {
        if (!isDrawing) return;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
        ctx.lineCap = "round";
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    // イベントリスナーはtegakiCanvasにアタッチ
    tegakiCanvas.addEventListener("mousedown", (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    tegakiCanvas.addEventListener("mousemove", draw);

    tegakiCanvas.addEventListener("mouseup", () => (isDrawing = false));
    tegakiCanvas.addEventListener("mouseout", () => (isDrawing = false));

    // === カラーパレットの追加 ===
    const palette = document.createElement("div"); // これはIIFE内部で宣言されているため、このIIFEが複数回実行されない限り問題ない
    palette.id = "colorPalette";
    palette.style.display = "flex";
    palette.style.marginTop = "10px";
    toolbar.appendChild(palette);

    const colors = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFFFFF"];

    colors.forEach(color => {
        const colorBox = document.createElement("div");
        colorBox.style.width = "20px";
        colorBox.style.height = "20px";
        colorBox.style.background = color;
        colorBox.style.border = "1px solid #000";
        colorBox.style.cursor = "pointer";
        colorBox.style.marginRight = "5px";
        colorBox.onclick = () => {
            penColor = color;
            penColorInput.value = color; // カラーピッカーも更新
        };
        palette.appendChild(colorBox);
    });

})();
