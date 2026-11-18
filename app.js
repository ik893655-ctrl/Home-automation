
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";


// =====================================
// FIREBASE CONFIGURATION
// =====================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "esp01-a45db.firebaseapp.com",
  databaseURL: "https://esp01-a45db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esp01-a45db",
  storageBucket: "esp01-a45db.firebasestorage.app",
  messagingSenderId: "420011000020",
  appId: "1:420011000020:web:147dd5ce9c069d9afd7b41"
};


// =====================================
// INITIALIZE FIREBASE
// =====================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// =====================================
// HTML ELEMENTS
// =====================================

const authBox = document.getElementById("authBox");
const controlBox = document.getElementById("controlBox");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const emailField = document.getElementById("emailField");
const passwordField = document.getElementById("passwordField");

const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");


// =====================================
// GPIO ELEMENTS
// =====================================

const gpioButtons = {
  gpio1: document.getElementById("gpio1Btn"),
  gpio2: document.getElementById("gpio2Btn"),
  gpio3: document.getElementById("gpio3Btn")
};

const gpioLabels = {
  gpio1: document.getElementById("gpio1Status"),
  gpio2: document.getElementById("gpio2Status"),
  gpio3: document.getElementById("gpio3Status")
};


// =====================================
// LISTENER MANAGEMENT
// =====================================

let unsubscribeListeners = [];

let currentStates = {
  gpio1: 0,
  gpio2: 0,
  gpio3: 0
};

let busyButtons = {};


// =====================================
// STATUS MESSAGE
// =====================================

function showMessage(message, type = "normal") {

  authMsg.textContent = message;

  authMsg.style.color =
    type === "error" ? "#ef4444" :
    type === "success" ? "#22c55e" :
    "#94a3b8";
}


// =====================================
// CONNECTION BADGE
// =====================================

function updateBadge(text, online = false) {

  badge.textContent = text;

  badge.className =
    online ? "status-badge online" : "status-badge offline";
}


// =====================================
// LOGIN
// =====================================

loginBtn.addEventListener("click", async () => {

  const email = emailField.value.trim();
  const password = passwordField.value;

  if (!email || !password) {
    showMessage("Please enter email and password.", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  showMessage("Connecting to Firebase...");

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showMessage("Login successful!", "success");

  } catch (error) {

    console.error("Login Error:", error);

    showMessage(
      getFriendlyError(error.code),
      "error"
    );

  } finally {

    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Login to Dashboard <span>→</span>';

  }

});


// =====================================
// FRIENDLY FIREBASE ERRORS
// =====================================

function getFriendlyError(code) {

  switch (code) {

    case "auth/invalid-email":
      return "Invalid email address.";

    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "Incorrect email or password.";

    case "auth/wrong-password":
      return "Incorrect password.";

    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";

    case "auth/network-request-failed":
      return "Network connection failed.";

    default:
      return "Login failed. Please try again.";

  }

}


// =====================================
// LOGOUT
// =====================================

logoutBtn.addEventListener("click", async () => {

  logoutBtn.disabled = true;

  try {

    await signOut(auth);

    showMessage("Logged out successfully.", "success");

  } catch (error) {

    console.error("Logout Error:", error);
    alert("Logout failed. Please try again.");

  } finally {

    logoutBtn.disabled = false;

  }

});


// =====================================
// AUTHENTICATION STATE
// =====================================

onAuthStateChanged(auth, (user) => {

  if (user) {

    authBox.style.display = "none";
    controlBox.style.display = "block";

    updateBadge("Authenticated", true);

    console.log("User Logged In:", user.email);

    startListeners();

  } else {

    authBox.style.display = "block";
    controlBox.style.display = "none";

    updateBadge("Offline", false);

    stopListeners();

    console.log("User Logged Out");

  }

});


// =====================================
// START FIREBASE LISTENERS
// =====================================

function startListeners() {

  // Prevent duplicate listeners
  stopListeners();

  Object.keys(gpioButtons).forEach((key) => {

    const databaseRef = ref(db, "/" + key);

    const unsubscribe = onValue(
      databaseRef,

      (snapshot) => {

        const value = snapshot.val();

        const state =
          value === true || Number(value) === 1 ? 1 : 0;

        updateUI(key, state);

      },

      (error) => {

        console.error("Database Listener Error:", error);

        showMessage(
          "Database connection error: " + error.message,
          "error"
        );

      }
    );

    unsubscribeListeners.push(unsubscribe);

  });

}


// =====================================
// STOP FIREBASE LISTENERS
// =====================================

function stopListeners() {

  unsubscribeListeners.forEach((unsubscribe) => {
    unsubscribe();
  });

  unsubscribeListeners = [];

}


// =====================================
// GPIO BUTTON CONTROL
// =====================================

Object.entries(gpioButtons).forEach(([key, button]) => {

  button.addEventListener("click", async () => {

    if (busyButtons[key]) return;

    const newState = currentStates[key] === 1 ? 0 : 1;

    busyButtons[key] = true;
    button.disabled = true;

    button.textContent = "Updating...";

    try {

      await set(
        ref(db, "/" + key),
        newState
      );

      console.log(key + " Updated:", newState);

    } catch (error) {

      console.error("GPIO Update Error:", error);

      alert("Failed to update " + key + ": " + error.message);

      updateUI(key, currentStates[key]);

    } finally {

      busyButtons[key] = false;
      button.disabled = false;

    }

  });

});


// =====================================
// UPDATE DEVICE UI
// =====================================

function updateUI(key, value) {

  const button = gpioButtons[key];
  const label = gpioLabels[key];

  if (!button || !label) return;

  const isOn = value === 1;

  currentStates[key] = isOn ? 1 : 0;

  button.classList.toggle("on", isOn);

  button.textContent = isOn ? "Turn OFF" : "Turn ON";

  label.classList.toggle("on", isOn);

  label.innerHTML = `
    <span class="status-dot"></span>
    Status: ${isOn ? "ON" : "OFF"}
  `;

}


// =====================================
// INITIAL STATE
// =====================================

Object.keys(gpioButtons).forEach((key) => {

  updateUI(key, 0);

});

console.log("Industrial Automation Dashboard Initialized");
