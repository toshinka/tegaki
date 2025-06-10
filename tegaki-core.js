// tegaki-core.js 修正案
// 二次裏用手書きブックマークレット

// 独自のグローバルオブジェクト（名前空間）を定義し、競合を避ける
// 既に存在する場合は再定義しない
window.MyTegakiTool = window.MyTegakiTool || {};

(function(T) { // MyTegakiToolオブジェクトをTとして渡す
    // 既にツールバーが存在するかチェック (IDをユニークにする)
    if (document.getElementById("myTegakiToolbar")) { // IDも衝突しない名前に変更
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

    // 各種設定 (Tオブジェクトの下に格納)
    T.penSize = 5; // ペンサイズ
    T.penColor = "#000000"; // ペン色 (黒)
    T.isDrawing = false;
    T.lastX = 0;
    T.lastY = 0;

    // === ツールバーの作成 ===
    const toolbar = document.createElement("div");
    toolbar.id = "myTegakiToolbar"; // ユニークなIDに変更
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
    penSizeInput.value = T.penSize;
    penSizeInput.oninput = (e) => {
        T.penSize = parseInt(e.target.value);
    };
    toolbar.appendChild(document.createTextNode("ペンサイズ: "));
    toolbar.appendChild(penSizeInput);
    toolbar.appendChild(document.createElement("br"));

    // [ペン色]
    const penColorInput = document.createElement("input");
    penColorInput.type = "color";
    penColorInput.value = T.penColor;
    penColorInput.oninput = (e) => {
        T.penColor = e.target.value;
    };
    toolbar.appendChild(document.createTextNode("ペン色: "));
    toolbar.appendChild(penColorInput);
    toolbar.appendChild(document.createElement("br"));

    // [消しゴム]
    const eraserButton = document.createElement("button");
    eraserButton.textContent = "消しゴム";
    eraserButton.onclick = () => {
        T.penColor = "#FFFFFF"; // 白に設定
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
        const imageDataURL = tegakiCanvas.toDataURL("image/png");
        const jsField = document.querySelector('textarea[name="js"]');
        if (jsField) {
            jsField.value = imageDataURL;
            alert("画像を手書き.js欄に転写しました！");
        } else {
            alert("手書き.js欄が見つかりませんでした。");
        }
    };
    toolbar.appendChild(transferButton);

    // === 描画処理 ===
    function draw(e) {
        if (!T.isDrawing) return;
        ctx.beginPath();
        ctx.moveTo(T.lastX, T.lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = T.penColor;
        ctx.lineWidth = T.penSize;
        ctx.lineCap = "round";
        ctx.stroke();
        [T.lastX, T.lastY] = [e.offsetX, e.offsetY];
    }

    tegakiCanvas.addEventListener("mousedown", (e) => {
        T.isDrawing = true;
        [T.lastX, T.lastY] = [e.offsetX, e.offsetY];
    });

    tegakiCanvas.addEventListener("mousemove", draw);
    tegakiCanvas.addEventListener("mouseup", () => (T.isDrawing = false));
    tegakiCanvas.addEventListener("mouseout", () => (T.isDrawing = false));

    // === カラーパレットの追加 ===
    // 'palette'変数名が既存のスクリプトと競合する可能性があるので、
    // ここもTオブジェクトの下に格納するか、よりユニークな名前を使用
    const colorPaletteElement = document.createElement("div"); // 変数名を変更
    colorPaletteElement.id = "myColorPalette"; // IDもユニークな名前に変更
    colorPaletteElement.style.display = "flex";
    colorPaletteElement.style.marginTop = "10px";
    toolbar.appendChild(colorPaletteElement);

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
            T.penColor = color;
            penColorInput.value = color;
        };
        colorPaletteElement.appendChild(colorBox); // 変更した変数名を使用
    });

})(window.MyTegakiTool); // MyTegakiToolオブジェクトを渡す
