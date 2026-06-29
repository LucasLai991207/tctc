// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js"; //  這裡加了 h

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyALncwZEf2Wu5ZHfP4H0FLLPWGAay6xWjw",
    authDomain: "tctc--sign-in-test1.firebaseapp.com", // ✅ 改回預設的兩個連字號
    projectId: "tctc--sign-in-test1",                 // ✅ 改回預設的兩個連字號
    storageBucket: "tctc--sign-in-test1.firebasestorage.app", // ✅ 改回預設的兩個連字號
    messagingSenderId: "469463996700",
    appId: "1:469463996700:web:facf8d702d8ccb936b42d9",
    measurementId: "G-7JX48W25SD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider(); 

const user_data_div = document.getElementById("user_data")
const avatar = document.getElementById("avatar")
const user_name = document.getElementById("name")
const user_email = document.getElementById("email")
const sign_in_btn = document.getElementById("sign_in_btn")


// 當按鈕被點擊時，執行裡面的 function
// 當按鈕被點擊時，執行裡面的 function
sign_in_btn.addEventListener("click", function() {
    
    // 1. 叫 Firebase 彈出 Google 登入視窗
    signInWithPopup(auth, provider)
        
        // 2. 如果【登入成功】，就把結果（result）傳給裡面的 function 處理
        .then(function(result) {
            // 從結果裡面，把 user（使用者資料）拿出來
            const user = result.user;
            console.log("登入成功了！資料在這裡：", user);

            // 檢查 Google 有沒有給圖片，有給才塞進去
            if (user.photoURL) {
                avatar.src = user.photoURL;
            } else {
                avatar.alt = "Google 沒有提供頭像";
            }

            // 把畫面的資料換成 Google 回傳的真實資料
            user_name.innerHTML = "<strong>姓名：</strong>" + user.displayName;
            user_email.innerHTML = "<strong>信箱：</strong>" + user.email;

            // 讓原本隱藏的 user_data 區塊顯示出來
            user_data_div.hidden = false;
        })
        
        // 3. 如果【登入失敗】，就把錯誤（error）傳給裡面的 function 處理
        .catch(function(error) {
            console.error("登入失敗，原因：", error.message);
        });

});