(function () {

    //偵測是否為行動裝置
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (!isMobile) return;

    const overlay = document.createElement("div");

    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        background-color: #0d1b2e;
        opacity: 0.9;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        font-family: 'Noto Sans TC', sans-serif;

        text-align: top;
    `;

    overlay.innerHTML = `
        <div style="font-size: 15rem;">⌨️</div>
        <h1 style="
        font-size: 6rem;
        color: #c9a84c;
        margin-bottom: 5rem;
        ">
        請使用非行動裝置開啟
        </h1>
        <p style="
        font-size: 2rem;

        max-width: 80%;
        color: #aaa; 
        line-height: 1.6;
        ">
        TCTC 需要實體鍵盤才能練習，目前不支援行動裝置。
        </p>
        <button id="skip-btn" style="
        margin-top: 4rem;
        padding: 0.6rem 1.4rem;

        background: transparent;

        border: 1px solid #555;
        color: #777;

        font-size: 5rem;

        border-radius: 3px;

        cursor: pointer;
        transition: border-color 0.2s, color 0.2s;
        "
        onclick="window.location.href='TCTC2-0-main.html'">
        我知道了
        </button>
    `;


    const append = () => {
        document.body.appendChild(overlay);

        const btn = document.getElementById("skip-btn");

        //按鈕是 inline寫的 無法直接用 CSS :hover
        btn.addEventListener("mouseenter", function () {
        btn.style.borderColor = "#c9a84c"; 
        btn.style.color = "#c9a84c";       
        });

        
        btn.addEventListener("mouseleave", function () {
        btn.style.borderColor = "#555";    
        btn.style.color = "#777";          
        });

        // 點擊後把整個遮罩從 DOM 移除
        btn.addEventListener("click", function () {
        overlay.remove();
        });
    };

    document.body ? append() : document.addEventListener("DOMContentLoaded", append);

})();