const statusEl = document.getElementById("status");
const joinPanel = document.getElementById("joinPanel");
const waitPanel = document.getElementById("waitPanel");
const questionPanel = document.getElementById("questionPanel");
const lockPanel = document.getElementById("lockPanel");
const feedbackPanel = document.getElementById("feedbackPanel");
const endPanel = document.getElementById("endPanel");
const connectionStatus = document.getElementById("connectionStatus");
const streakBadge = document.getElementById("streakBadge");
const streakCount = document.getElementById("streakCount");

const roomInput = document.getElementById("roomInput");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const playerLabel = document.getElementById("playerLabel");
const waitTitleEl = document.getElementById("waitTitle");
const waitTitlePrefixEl = document.getElementById("waitTitlePrefix");
const waitTitleSuffixEl = document.getElementById("waitTitleSuffix");
const waitNoteEl = document.getElementById("waitNote");
const waitRoomCodeEl = document.getElementById("waitRoomCode");
const avatarPicker = document.getElementById("avatarPicker");
let avatarButtons = [];
const avatarWait = document.getElementById("avatarWait");
const avatarPlay = document.getElementById("avatarPlay");
const questionMetaEl = document.getElementById("questionMeta");

const timerEl = document.getElementById("timer");
const qText = document.getElementById("qText");
const qImage = document.getElementById("qImage");
const questionCardEl = document.getElementById("questionCard");
const questionToggleBtn = document.getElementById("questionToggleBtn");
const lockMsg = document.getElementById("lockMsg");
const flash = document.getElementById("flash");
const lockChoiceEl = document.getElementById("lockChoice");
const lifelineFiftyBtn = document.getElementById("lifelineFiftyBtn");
const lifelineSkipBtn = document.getElementById("lifelineSkipBtn");
const lifelineDoubleBtn = document.getElementById("lifelineDoubleBtn");
const heatmapCardEl = document.getElementById("heatmapCard");
const heatFillEls = [0, 1, 2, 3].map(i => document.getElementById(`heatFill${i}`));
const heatValEls = [0, 1, 2, 3].map(i => document.getElementById(`heatVal${i}`));
const reactionRow = document.getElementById("reactionRow");
const feedbackIconEl = document.getElementById("feedbackIcon");
const feedbackTitleEl = document.getElementById("feedbackTitle");
const feedbackSubEl = document.getElementById("feedbackSub");

const toastEl = document.getElementById("toast");
const scoreCorrectEl = document.getElementById("scoreCorrect");
const scoreWrongEl = document.getElementById("scoreWrong");
const scoreMissedEl = document.getElementById("scoreMissed");

const endNameEl = document.getElementById("endName");
const endMetaEl = document.getElementById("endMeta");
const endTotalQEl = document.getElementById("endTotalQ");
const endRoundsEl = document.getElementById("endRounds");
const endTopEl = document.getElementById("endTop");
const endScoreEl = document.getElementById("endScore");
const endCorrectEl = document.getElementById("endCorrect");
const endWrongEl = document.getElementById("endWrong");
const endMissedEl = document.getElementById("endMissed");
const endAvatarEl = document.getElementById("endAvatar");
const leaveBtn = document.getElementById("leaveBtn");

const clickSfx = document.getElementById("clickSfx");

let ws = null;
let room = "";
let playerId = "";
let playerName = "";
let activeQuestionId = null;
let hasAnswered = false;
let timerHandle = null;
let timerEndsAt = 0;
let paused = false;
let pendingAnswer = -1;
let currentStreak = 0;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let reconnectTimer = null;
let isReconnecting = false;
let wakeLock = null;
let gameActive = false; // Track if currently in active game
let joinInProgress = false;
let joinResponseTimer = null;
let queuedJoinPayload = null;
let avatarIndex = null;
// Fallback list — loadAvatars() replaces this from /api/avatars (general subfolder)
let avatarFiles = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `avatars/general/general_${n}.png`;
});

// ── Avatar state system ───────────────────────────────────────────────────────
// States: general | correct | wrong | steak | win
// "steak" matches the folder name (typo in assets — kept consistent)
let _avatarState = "general";
let _avatarStateTimer = null;

function getAvatarSrc(state) {
  if (avatarIndex === null) return "";
  const n = String(avatarIndex + 1).padStart(2, "0");
  return `avatars/${state}/${state}_${n}.png`;
}

const _AVATAR_ANIM_CLASSES = ["avatar-correct", "avatar-wrong", "avatar-steak", "avatar-win"];

function _applyAvatarAnim(el, state) {
  if (!el) return;
  _AVATAR_ANIM_CLASSES.forEach(c => el.classList.remove(c));
  if (state === "general") return;
  void el.offsetWidth; // force reflow so animation restarts if same class re-applied
  el.classList.add(`avatar-${state}`);
}

function setAvatarState(state, revertAfterMs) {
  if (_avatarStateTimer) { clearTimeout(_avatarStateTimer); _avatarStateTimer = null; }
  _avatarState = state;
  const src = getAvatarSrc(state);
  if (avatarWait) { avatarWait.src = src; _applyAvatarAnim(avatarWait, state); }
  if (avatarPlay) { avatarPlay.src = src; _applyAvatarAnim(avatarPlay, state); }

  if (revertAfterMs > 0) {
    _avatarStateTimer = setTimeout(() => {
      _avatarStateTimer = null;
      setAvatarState(currentStreak >= 3 ? "steak" : "general", 0);
    }, revertAfterMs);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Test-harness mode ─────────────────────────────────────────────────────────
// Activated by ?testMode=1 URL param. Skips localStorage so each iframe session
// is fully independent. Pre-fills name/room/avatar from URL and auto-joins.
const _tp = new URLSearchParams(location.search);
const TEST_MODE   = _tp.get("testMode") === "1";
const TEST_ROOM   = (TEST_MODE && _tp.get("testRoom"))   ? _tp.get("testRoom").toUpperCase() : "";
const TEST_NAME   = (TEST_MODE && _tp.get("testName"))   ? _tp.get("testName")  : "";
const TEST_AVATAR = (TEST_MODE && _tp.get("testAvatar")) ? parseInt(_tp.get("testAvatar")) : 0;
const TEST_AUTOJOIN = TEST_MODE && _tp.get("autoJoin") === "1";
// ─────────────────────────────────────────────────────────────────────────────

let scoreCorrect = 0, scoreWrong = 0, scoreMissed = 0;
let scorePoints = 0;
let lastFirebaseResultToken = "";
let pendingResultQuestionId = "";
let feedbackShownAt = 0;
const phoneAnswersOnlyMedia = window.matchMedia("(max-width: 768px), (pointer: coarse)");
let questionExpandedByUser = !phoneAnswersOnlyMedia.matches;
const questionVisibilityPrefPrefix = "quizQuestionVisiblePref";
let lifelineUnlocked = false;
let lifelineConsumed = false;

// Backend mode: default websocket. Use ?backend=firebase to switch later.
const backendMode = (new URLSearchParams(location.search).get("backend") || "ws").toLowerCase();
const useFirebase = backendMode === "firebase";
let fbApp = null;
let fbDb = null;
let fbAuth = null;
let fbRoomRef = null;
let fbUnsub = [];
let fbSeenEventKeys = new Set();
let pendingWaitPanelTimer = null;

function initFirebase() {
  if (!useFirebase) return false;
  if (!window.firebase || !window.FIREBASE_CONFIG) {
    console.error("[Firebase] SDK or config missing.");
    setStatus("Firebase config missing");
    return false;
  }

  try {
    if (firebase.apps && firebase.apps.length > 0) {
      fbApp = firebase.app();
    } else {
      fbApp = firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    fbAuth = firebase.auth();
    fbDb = firebase.database();
    console.log("[Firebase] Initialized");
    return true;
  } catch (e) {
    console.error("[Firebase] Init failed:", e);
    setStatus("Firebase init failed");
    return false;
  }
}

async function firebaseSignIn() {
  if (!fbAuth) return null;
  if (fbAuth.currentUser) return fbAuth.currentUser;
  const res = await fbAuth.signInAnonymously();
  return res.user;
}

function fbRef(path) {
  return fbDb.ref(path);
}

function fbOn(ref, event, cb) {
  ref.on(event, cb);
  fbUnsub.push(() => ref.off(event, cb));
}

function fbClearListeners() {
  for (const off of fbUnsub) off();
  fbUnsub = [];
}

function clearPendingWaitPanelTransition() {
  if (pendingWaitPanelTimer) {
    clearTimeout(pendingWaitPanelTimer);
    pendingWaitPanelTimer = null;
  }
}

function scheduleWaitPanelTransition(delayMs, statusText) {
  clearPendingWaitPanelTransition();
  pendingWaitPanelTimer = setTimeout(() => {
    pendingWaitPanelTimer = null;
    // If question already started, do not override back to wait panel.
    if (activeQuestionId) return;
    setWaitPanelState("between");
    show(waitPanel);
    if (questionMetaEl) questionMetaEl.textContent = `${playerName || "Player"} • Waiting`;
    setStatus(statusText || "⌛ Next question coming...");
  }, Math.max(0, Number(delayMs) || 0));
}

function clearJoinResponseTimeout() {
  if (joinResponseTimer) clearTimeout(joinResponseTimer);
  joinResponseTimer = null;
  joinInProgress = false;
}

function startJoinResponseTimeout() {
  clearJoinResponseTimeout();
  joinInProgress = true;
  joinResponseTimer = setTimeout(() => {
    if (!joinInProgress) return;
    joinInProgress = false;
    joinBtn.disabled = false;
    setStatus("Join timeout");
    toast("⚠️ Room unavailable or connection delayed. Check code and try again.", 3800);
  }, 7000);
}

function normalizeOutcome(value) {
  if (!value || typeof value !== "string") return "";
  const v = value.toLowerCase();
  if (v === "correct" || v === "wrong" || v === "missed" || v === "skipped") return v === "skipped" ? "missed" : v;
  return "";
}

function getLatestFirebaseResult(resultsNodeValue, preferredQuestionId = "") {
  if (!resultsNodeValue || typeof resultsNodeValue !== "object") return null;

  // Backward-compatible: older payload may have been stored directly at /results/{playerId}.
  if (typeof resultsNodeValue.outcome === "string" || typeof resultsNodeValue.status === "string") {
    return { key: "__direct__", payload: resultsNodeValue };
  }

  const preferredKey = String(preferredQuestionId || "");
  if (preferredKey && Object.prototype.hasOwnProperty.call(resultsNodeValue, preferredKey)) {
    const preferredPayload = resultsNodeValue[preferredKey];
    if (preferredPayload && typeof preferredPayload === "object") {
      const preferredOutcome = normalizeOutcome(preferredPayload.outcome || preferredPayload.status);
      if (preferredOutcome) {
        return { key: preferredKey, payload: preferredPayload };
      }
    }
  }

  let latestKey = "";
  let latestPayload = null;
  let latestTs = -1;

  for (const [key, payload] of Object.entries(resultsNodeValue)) {
    if (!payload || typeof payload !== "object") continue;
    const outcome = normalizeOutcome(payload.outcome || payload.status);
    if (!outcome) continue;

    const ts = Number(payload.t);
    const comparableTs = Number.isFinite(ts) ? ts : 0;
    if (comparableTs >= latestTs) {
      latestTs = comparableTs;
      latestKey = key;
      latestPayload = payload;
    }
  }

  if (!latestPayload) return null;
  return { key: latestKey, payload: latestPayload };
}

function applyActiveFirebaseQuestion(q, { silent = false } = {}) {
  if (!q || typeof q !== "object") return false;
  const qid = String(q.id || "");
  if (!qid) return false;

  gameActive = true; // re-enter active game (covers replay after GAME_END in Firebase mode)
  clearPendingWaitPanelTransition();
  activeQuestionId = qid;
  pendingResultQuestionId = qid;
  hasAnswered = false;
  pendingAnswer = -1;
  resetHeatmap();
  resetAnswerButtonVisibility();
  resetQuestionVisibilityDefault();
  lockMsg.classList.add("hidden");
  clearAnswerHighlights();
  enableAnswerButtons(true);
  updateLifelineButtons();

  setQuestionText(q.text || "");
  setOptions(q.options || []);
  setQuestionImage(q.image || "");
  setOptionImages(q.optionImages || []);
  if (questionMetaEl) questionMetaEl.textContent = `${playerName || "Player"} • Question live`;
  if (!silent) {
    setStatus("Question active ✅");
    toast("📝 Answer now!");
  }

  const baseDurationMs = Math.max(0, Number(q.durationMs || 0));
  const startedAtMs = Number(q.startedAt || 0);
  let remainingMs = baseDurationMs;
  if (baseDurationMs > 0 && Number.isFinite(startedAtMs) && startedAtMs > 0) {
    remainingMs = Math.max(0, baseDurationMs - Math.max(0, Date.now() - startedAtMs));
  }

  startTimer(remainingMs);
  show(questionPanel);
  requestWakeLock();
  return true;
}

async function firebaseForceStateResync({ restoreLock = false } = {}) {
  if (!useFirebase || !fbRoomRef) return false;
  try {
    const qSnap = await fbRoomRef.child("question").get();
    if (!qSnap.exists()) return false;
    const applied = applyActiveFirebaseQuestion(qSnap.val() || {}, { silent: true });
    if (!applied) return false;

    if (restoreLock && playerId) {
      try {
        const ansSnap = await fbRoomRef.child("answers").child(playerId).get();
        if (ansSnap.exists()) {
          const ans = ansSnap.val() || {};
          if (Number.isInteger(Number(ans.choiceIndex))) {
            pendingAnswer = Number(ans.choiceIndex);
          }
          hasAnswered = true;
          lockMsg.classList.remove("hidden");
          const lockMain = lockMsg.querySelector("div");
          if (lockMain) lockMain.textContent = "✅ Submitted";
          enableAnswerButtons(false);
          if (pendingAnswer >= 0) highlightSelectedAnswer(pendingAnswer);
          showLockedPanel(pendingAnswer, !!ans.skipped);
          updateLifelineButtons();
        }
      } catch {}
    }
    return true;
  } catch (err) {
    console.warn("[Firebase] State resync failed:", err);
    return false;
  }
}

async function firebaseJoin(roomCode, name, avatarIndex) {
  if (!initFirebase()) {
    clearJoinResponseTimeout();
    joinBtn.disabled = false;
    toast("❌ Firebase config missing. Cannot join.", 3200);
    return;
  }
  lastFirebaseResultToken = "";

  setStatus("Connecting (Firebase)...");

  try {
    const user = await firebaseSignIn();
    if (!user) throw new Error("Auth failed");

    playerId = user.uid;
    room = roomCode;
    playerName = name;
    resetQuestionVisibilityDefault();

    const roomPath = `rooms/${roomCode}`;
    fbRoomRef = fbRef(roomPath);
    fbSeenEventKeys = new Set();

    const hostSnap = await fbRoomRef.child("hostId").get();
    if (!hostSnap.exists()) {
      clearJoinResponseTimeout();
      setStatus("Join failed: NO_HOST");
      joinBtn.disabled = false;
      toast("❌ Room not available. Check the room code.", 3200);
      return;
    }

    const lockedSnap = await fbRoomRef.child("locked").get();
    if (lockedSnap.exists() && lockedSnap.val() === true) {
      clearJoinResponseTimeout();
      setStatus("Join failed: ROOM_LOCKED");
      joinBtn.disabled = false;
      toast("🔒 Room is locked by host.", 3200);
      return;
    }

    await fbRoomRef.child("players").child(playerId).set({
      name: playerName,
      avatarIndex,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
    fbRoomRef.child("players").child(playerId).onDisconnect().remove();

    clearJoinResponseTimeout();
    gameActive = true;
    updateAvatarPreviews();
    setStatus(`Connected ✅ Room ${roomCode}`);
    playerLabel.textContent = `${playerName}`;
    if (waitRoomCodeEl) waitRoomCodeEl.textContent = roomCode;
    if (questionMetaEl) questionMetaEl.textContent = `${playerName || "Player"} • Waiting`;
    setWaitPanelState("joined");
    show(waitPanel);
    toast("✅ Joined successfully!");
    saveSession();

    // Listen to room state
    fbOn(fbRoomRef.child("paused"), "value", snap => {
      paused = !!snap.val();
      if (paused) toast("⏸️ Paused by host");
      else toast("▶️ Resumed");
      enableAnswerButtons(!hasAnswered && !!activeQuestionId);
    });

    fbOn(fbRoomRef.child("locked"), "value", snap => {
      if (snap.val() === true) toast("🔒 Room locked by host");
    });

    // Current question
    fbOn(fbRoomRef.child("question"), "value", snap => {
      if (!snap.exists()) return;
      applyActiveFirebaseQuestion(snap.val() || {}, { silent: false });
    });

    // Results for this player
    fbOn(fbRoomRef.child("results").child(playerId), "value", snap => {
      if (!snap.exists()) return;
      const latest = getLatestFirebaseResult(snap.val(), pendingResultQuestionId || activeQuestionId || "");
      if (!latest || !latest.payload) return;

      const r = latest.payload;
      const outcome = normalizeOutcome(r.outcome || r.status);
      const token = latest.key || "__none__";
      if (token === lastFirebaseResultToken) return;
      lastFirebaseResultToken = token;

      flashColor(outcome);
      // Avatar state for Firebase result
      if (outcome === "correct") setAvatarState("correct", 3000);
      else setAvatarState("wrong", 3000);
      const messages = {
        correct: "🎉 Correct!",
        wrong: "❌ Wrong",
        missed: "⏱️ Time's up"
      };
      toast(messages[outcome] || "Result", 2500);

      if (typeof r.scoreCorrect === "number") {
        setScores(r.scoreCorrect, r.scoreWrong, r.scoreMissed, r.scorePoints);
      }
      if (typeof r.streak === "number") {
        currentStreak = Math.max(0, Number(r.streak || 0));
        if (currentStreak >= 3) {
          streakCount.textContent = currentStreak;
          streakBadge.classList.remove("hidden");
        } else {
          streakBadge.classList.add("hidden");
        }
      }
      if (r.pointsGained > 0) toast(`+${r.pointsGained} pts`, 1700);
      if (r.speedBonus > 0) toast(`⚡ Speed bonus +${r.speedBonus}`, 1900);
      if (r.lifelineBonus > 0) toast(`✨ Double bonus +${r.lifelineBonus}`, 1900);
      showMilestones(r.milestones || []);
      lifelineUnlocked = !!r.lifelineUnlocked;
      lifelineConsumed = !!r.lifelineConsumed;

      if (navigator.vibrate) {
        if (outcome === "correct") navigator.vibrate([100, 50, 100, 50, 100]);
        else navigator.vibrate(300);
      }

      clearAnswerHighlights();
      lockMsg.classList.add("hidden");
      activeQuestionId = null;
      pendingResultQuestionId = "";
      updateLifelineButtons();
      showFeedbackPanel(outcome);
      scheduleWaitPanelTransition(1000, "⌛ Next question coming...");
    });

    // One-time read: catch any result that was written before the listener attached
    // (happens on rejoin or if grading completes very quickly after joining)
    fbRoomRef.child("results").child(playerId).once("value", snap => {
        if (!snap || !snap.exists()) return;
        const latest = getLatestFirebaseResult(snap.val(), pendingResultQuestionId || activeQuestionId || "");
        if (!latest || !latest.payload) return;
        const token = latest.key || "__none__";
        if (token === lastFirebaseResultToken) return;
        lastFirebaseResultToken = token;
        const r = latest.payload;
        const outcome = normalizeOutcome(r.outcome || r.status);
        if (typeof r.scoreCorrect === "number") setScores(r.scoreCorrect, r.scoreWrong, r.scoreMissed, r.scorePoints);
        lifelineUnlocked = !!r.lifelineUnlocked;
        lifelineConsumed = !!r.lifelineConsumed;
        updateLifelineButtons();
        showFeedbackPanel(outcome);
    });

    // Scores for this player (fallback)
    fbOn(fbRoomRef.child("scores").child(playerId), "value", snap => {
      if (!snap.exists()) return;
      const s = snap.val();
      if (!s) return;
      if (typeof s.correct === "number") {
        setScores(s.correct, s.wrong || 0, s.missed || 0, s.points);
      }
    });

    // Lifeline state for this player
    fbOn(fbRoomRef.child("lifelines").child(playerId), "value", snap => {
      if (!snap.exists()) return;
      const lf = snap.val() || {};
      lifelineUnlocked = !!lf.unlocked;
      lifelineConsumed = !!lf.consumed;
      updateLifelineButtons();
    });

    // Heatmap node (fallback path in addition to events)
    fbOn(fbRoomRef.child("heatmap"), "value", snap => {
      if (!snap.exists()) return;
      const h = snap.val() || {};
      if (!activeQuestionId || h.questionId !== activeQuestionId) return;
      renderHeatmap(h.counts || [], h.total || 0);
    });

    // Events stream: lifeline/top-movers/clutch/reactions/ack
    try {
      const initialEvents = await fbRoomRef.child("events").once("value");
      if (initialEvents && initialEvents.exists()) {
        initialEvents.forEach(child => {
          if (child && child.key) fbSeenEventKeys.add(child.key);
        });
      }
    } catch {}
    fbOn(fbRoomRef.child("events"), "child_added", snap => {
      if (!snap.exists()) return;
      if (fbSeenEventKeys.has(snap.key)) return;
      fbSeenEventKeys.add(snap.key);
      handleRealtimeEvent(snap.val() || {});
    });

    // Game end
    fbOn(fbRoomRef.child("gameEnd"), "value", snap => {
      if (!snap.exists()) return;
      const g = snap.val();
      if (!g) return;

      clearPendingWaitPanelTransition();
      stopTimer();
      activeQuestionId = null;
      hasAnswered = false;
      pendingAnswer = -1;
      clearAnswerHighlights();
      gameActive = false;

      endNameEl.textContent = g.name || playerName || "Player";
      const pid = playerId ? `ID ${playerId.slice(0, 6)}` : "";
      const date = g.date || "";
      endMetaEl.textContent = [pid, date].filter(Boolean).join(" · ");
      endTotalQEl.textContent = String(g.totalQuestions || 0);
      endRoundsEl.textContent = String(g.rounds || 0);
      renderTopPlayers(endTopEl, g.topPlayers, g.topNames, g.topName);
      if (endCorrectEl) endCorrectEl.textContent = String(scoreCorrect);
      if (endWrongEl) endWrongEl.textContent = String(scoreWrong);
      if (endMissedEl) endMissedEl.textContent = String(scoreMissed);
      if (endScoreEl) endScoreEl.textContent = String(scorePoints);

      show(endPanel);
      setStatus("🏁 Quiz finished!");

      if (isPlayerTopScorer(g.topPlayers, g.topNames, g.topName, playerName)) {
        setAvatarState("win", 0);
        if (endAvatarEl) endAvatarEl.src = getAvatarSrc("win");
        createConfetti();
        toast("🏆 You're a winner!", 5000);
      } else {
        setAvatarState("general", 0);
      }
    });

    // One-shot resync to avoid getting stuck on wait if listener delivery lags.
    await firebaseForceStateResync({ restoreLock: false });
  } catch (err) {
    clearJoinResponseTimeout();
    console.error("[Firebase] Join failed:", err);
    setStatus("Join failed");
    joinBtn.disabled = false;
    toast("❌ Join failed. Please retry.", 3200);
  }
}

// Wake Lock API to prevent screen from turning off
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen will stay on');
      
      wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Released');
      });
    }
  } catch (err) {
    console.warn('[WakeLock] Not supported or denied:', err);
  }
}

// Re-request wake lock and reconnect when page becomes visible again
// Bug fix: removed "wakeLock !== null" guard — phones without WakeLock API
// (many Androids) would never trigger the reconnect, silently losing mid-game state.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;

  await requestWakeLock();

  if (useFirebase) {
    // Firebase SDK manages its own connection, but re-auth if the token expired.
    if (fbAuth && !fbAuth.currentUser) {
      try { await firebaseSignIn(); } catch {}
    }
    return;
  }

  if (gameActive && room && playerId && playerName && ws && ws.readyState !== WebSocket.OPEN) {
    console.log('[Visibility] Page visible again — reconnecting WS');
    reconnect();
  }
});

// Try to keep screen awake after first user interaction
document.addEventListener('touchstart', () => { requestWakeLock(); }, { passive: true });
document.addEventListener('mousedown', () => { requestWakeLock(); });

// Save session to localStorage (only during active game)
function saveSession() {
  if (TEST_MODE) return; // test sessions are never persisted
  if (!room || !playerId || !playerName || !gameActive) return;
  
  const session = {
    room,
    playerId,
    playerName,
    avatarIndex,
    scoreCorrect,
    scoreWrong,
    scoreMissed,
    scorePoints,
    currentStreak,
    timestamp: Date.now()
  };
  
  localStorage.setItem('quizSession', JSON.stringify(session));
  console.log('[Session] Saved:', session);
}

// Load session from localStorage
function loadSession() {
  if (TEST_MODE) return false; // each test iframe starts fresh
  try {
    const saved = localStorage.getItem('quizSession');
    if (!saved) return false;
    
    const session = JSON.parse(saved);
    
    // Check if session is less than 30 minutes old
    const age = Date.now() - session.timestamp;
    if (age > 120 * 60 * 1000) {
      console.log('[Session] Expired');
      localStorage.removeItem('quizSession');
      return false;
    }
    
    room = session.room;
    playerId = session.playerId;
    playerName = session.playerName;
    avatarIndex = Number.isInteger(session.avatarIndex) ? session.avatarIndex : null;
    scoreCorrect = session.scoreCorrect || 0;
    scoreWrong = session.scoreWrong || 0;
    scoreMissed = session.scoreMissed || 0;
    scorePoints = session.scorePoints || 0;
    currentStreak = session.currentStreak || 0;
    gameActive = true;
    
    setScores(scoreCorrect, scoreWrong, scoreMissed, scorePoints);
    if (avatarIndex !== null) setAvatarIndex(avatarIndex);
    if (playerLabel) playerLabel.textContent = playerName || "Player";
    if (waitRoomCodeEl) waitRoomCodeEl.textContent = room || "----";
    resetQuestionVisibilityDefault();
    setWaitPanelState("between");
    
    console.log('[Session] Restored:', session);
    return true;
  } catch (err) {
    console.error('[Session] Load failed:', err);
    return false;
  }
}

// Clear session
function clearSession() {
  localStorage.removeItem('quizSession');
  clearJoinResponseTimeout();
  clearPendingWaitPanelTransition();
  queuedJoinPayload = null;
  room = "";
  playerId = "";
  playerName = "";
  avatarIndex = null;
  gameActive = false;
  scoreCorrect = 0;
  scoreWrong = 0;
  scoreMissed = 0;
  scorePoints = 0;
  currentStreak = 0;
  lastFirebaseResultToken = "";
  pendingResultQuestionId = "";
  feedbackShownAt = 0;
  questionExpandedByUser = loadQuestionVisibilityPreference();
  lifelineUnlocked = false;
  lifelineConsumed = false;
  fbSeenEventKeys = new Set();
  setAvatarIndex(null);
  if (waitRoomCodeEl) waitRoomCodeEl.textContent = "----";
  if (questionMetaEl) questionMetaEl.textContent = "Ready to answer";
  updateQuestionCardVisibility();
  resetHeatmap();
  resetAnswerButtonVisibility();
  updateLifelineButtons();
  setWaitPanelState("joined");
  console.log('[Session] Cleared');
}

function setStatus(txt) { statusEl.textContent = txt; }

function show(panel) {
  joinPanel.classList.add("hidden");
  waitPanel.classList.add("hidden");
  questionPanel.classList.add("hidden");
  if (lockPanel) lockPanel.classList.add("hidden");
  if (feedbackPanel) feedbackPanel.classList.add("hidden");
  endPanel.classList.add("hidden");
  panel.classList.remove("hidden");
}

function setWaitPanelState(mode) {
  if (!waitTitleEl || !waitNoteEl) return;
  if (mode === "between") {
    if (waitTitlePrefixEl) waitTitlePrefixEl.textContent = "Get ready,";
    if (waitTitleSuffixEl) waitTitleSuffixEl.textContent = "";
    waitNoteEl.textContent = "Next question is loading. Stay sharp.";
  } else {
    if (waitTitlePrefixEl) waitTitlePrefixEl.textContent = "You're in,";
    if (waitTitleSuffixEl) waitTitleSuffixEl.textContent = "!";
    waitNoteEl.textContent = "Get ready. The host will start the round any second now.";
  }
}

function showReactionBurst(emoji, label = "") {
  const el = document.createElement("div");
  el.className = "reaction-burst";
  el.textContent = emoji;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
  if (label) toast(`${emoji} ${label}`, 1200);
}

function updateLifelineButtons() {
  const disabled = !activeQuestionId || hasAnswered || lifelineConsumed || !lifelineUnlocked;
  if (lifelineFiftyBtn) lifelineFiftyBtn.disabled = disabled;
  if (lifelineSkipBtn) lifelineSkipBtn.disabled = disabled;
  if (lifelineDoubleBtn) lifelineDoubleBtn.disabled = disabled;
}

function useLifeline(kind) {
  if (!activeQuestionId || !room) return;
  if (lifelineConsumed || !lifelineUnlocked) return;
  if (useFirebase) {
    if (!fbRoomRef || !playerId) return;
    fbRoomRef.child("lifelineRequests").push({
      playerId,
      questionId: activeQuestionId,
      lifeline: kind,
      t: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {
      toast("❌ Lifeline request failed", 1700);
    });
    return;
  }
  send({ type: "LIFELINE_USE", room, questionId: activeQuestionId, lifeline: kind });
}

function applyFiftyEliminate(eliminate) {
  const arr = Array.isArray(eliminate)
    ? eliminate
    : (eliminate && typeof eliminate === "object" ? Object.values(eliminate) : []);
  if (!arr.length) return;
  const btns = document.querySelectorAll(".ansBtn");
  for (const idx of arr) {
    const i = Number(idx);
    if (!Number.isInteger(i) || i < 0 || i > 3) continue;
    const btn = btns[i];
    if (!btn) continue;
    btn.style.opacity = "0.32";
    btn.style.pointerEvents = "none";
  }
}

function resetAnswerButtonVisibility() {
  document.querySelectorAll(".ansBtn").forEach(btn => {
    btn.style.opacity = "";
    btn.style.pointerEvents = "";
  });
}

function resetHeatmap() {
  if (heatmapCardEl) heatmapCardEl.classList.add("hidden");
  for (let i = 0; i < 4; i++) {
    if (heatFillEls[i]) heatFillEls[i].style.width = "0%";
    if (heatValEls[i]) heatValEls[i].textContent = "0";
  }
}

function normalizeNumericArray(input, len = 4) {
  if (Array.isArray(input)) {
    const out = [];
    for (let i = 0; i < len; i++) out.push(Number(input[i] || 0));
    return out;
  }
  if (input && typeof input === "object") {
    const out = [];
    for (let i = 0; i < len; i++) out.push(Number(input[i] || input[String(i)] || 0));
    return out;
  }
  return new Array(len).fill(0);
}

function renderHeatmap(counts, total) {
  if (!heatmapCardEl) return;
  const normalized = normalizeNumericArray(counts, 4);
  const safeTotal = Number(total) > 0 ? Number(total) : 1;
  for (let i = 0; i < 4; i++) {
    const v = Number(normalized[i] || 0);
    const pct = Math.max(0, Math.min(100, (v / safeTotal) * 100));
    if (heatFillEls[i]) heatFillEls[i].style.width = `${pct}%`;
    if (heatValEls[i]) heatValEls[i].textContent = String(v);
  }
  heatmapCardEl.classList.remove("hidden");
}

function showTopMovers(movers) {
  if (!Array.isArray(movers) || movers.length === 0) return;
  const text = movers
    .filter(m => m && typeof m.name === "string")
    .map(m => `${m.name} +${Number(m.gain || 0)}`)
    .join(" • ");
  if (text) toast(`Top movers: ${text}`, 2800);
}

function showMilestones(milestones) {
  if (!Array.isArray(milestones) || milestones.length === 0) return;
  for (let i = 0; i < milestones.length; i++) {
    const m = String(milestones[i] || "").trim();
    if (!m) continue;
    setTimeout(() => toast(`🏅 ${m}`, 2200), i * 420);
  }
}

function handleRealtimeEvent(msg) {
  if (!msg || typeof msg !== "object") return;

  if (msg.to && playerId && String(msg.to) !== String(playerId)) return;

  if (msg.type === "REACTION_BURST") {
    if (msg.emoji) showReactionBurst(String(msg.emoji || ""), "");
    return;
  }

  if (msg.type === "TOP_MOVERS") {
    showTopMovers(msg.movers || []);
    return;
  }

  if (msg.type === "CLUTCH_HIGHLIGHT") {
    const name = String(msg.name || "A player");
    toast(`⚡ Clutch: ${name} was the only correct answer!`, 3000);
    return;
  }

  if (msg.type === "ANSWER_HEATMAP") {
    if (!activeQuestionId || msg.questionId !== activeQuestionId) return;
    renderHeatmap(msg.counts || [], msg.total || 0);
    return;
  }
  if (msg.type === "LIFELINE_ACK") {
    if (!msg.accepted) {
      toast(`❌ Lifeline unavailable (${msg.reason || "not allowed"})`, 2000);
      return;
    }
    const kind = String(msg.lifeline || "").toLowerCase();
    lifelineConsumed = true;
    lifelineUnlocked = false;
    updateLifelineButtons();
    if (kind === "double") toast("✨ Double armed for this question!", 2200);
    else if (kind === "skip") toast("⏭️ Skip used", 1800);
    else if (kind === "fifty") toast("✂️ 50/50 activated", 1800);
    return;
  }

  if (msg.type === "LIFELINE_EFFECT") {
    const kind = String(msg.lifeline || "").toLowerCase();
    if (kind === "fifty") applyFiftyEliminate(msg.eliminate || []);
    return;
  }

  if (msg.type === "ANSWER_ACK") {
    if (msg.accepted) {
      hasAnswered = true;
      if (Number.isInteger(Number(msg.choiceIndex))) {
        pendingAnswer = Number(msg.choiceIndex);
      }
      lockMsg.classList.remove("hidden");
      lockMsg.querySelector("div").textContent = "✅ Submitted";
      enableAnswerButtons(false);
      if (pendingAnswer >= 0) highlightSelectedAnswer(pendingAnswer);
      showLockedPanel(pendingAnswer, !!msg.skipped);
      updateLifelineButtons();
    } else {
      hasAnswered = false;
      pendingAnswer = -1;
      lockMsg.classList.add("hidden");
      enableAnswerButtons(true);
      clearAnswerHighlights();
      show(questionPanel);
      updateLifelineButtons();
      setStatus(`Answer rejected: ${msg.reason || "Rejected"}`);
      toast(`❌ ${msg.reason || "Rejected"}`);
    }
  }
}

function getQuestionVisibilityPrefStorageKey() {
  if (playerId && String(playerId).trim()) {
    return `${questionVisibilityPrefPrefix}:pid:${String(playerId).trim().toLowerCase()}`;
  }
  if (playerName && String(playerName).trim()) {
    return `${questionVisibilityPrefPrefix}:name:${String(playerName).trim().toLowerCase()}`;
  }
  return `${questionVisibilityPrefPrefix}:device`;
}

function loadQuestionVisibilityPreference() {
  try {
    const raw = localStorage.getItem(getQuestionVisibilityPrefStorageKey());
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch (err) {
    console.warn("[Pref] Failed to load question visibility preference", err);
  }
  return !phoneAnswersOnlyMedia.matches;
}

function saveQuestionVisibilityPreference(expanded) {
  try {
    localStorage.setItem(getQuestionVisibilityPrefStorageKey(), expanded ? "1" : "0");
  } catch (err) {
    console.warn("[Pref] Failed to save question visibility preference", err);
  }
}

function hasQuestionContent() {
  const hasText = !!(qText && !qText.classList.contains("hidden") && qText.textContent.trim());
  const hasImage = !!(qImage && !qImage.classList.contains("hidden") && qImage.getAttribute("src"));
  return hasText || hasImage;
}

function updateQuestionCardVisibility() {
  if (!questionCardEl) return;

  const isPhone = phoneAnswersOnlyMedia.matches;
  const hasContent = hasQuestionContent();
  const useAnswersOnlyDefault = isPhone && hasContent;
  const showQuestion = !useAnswersOnlyDefault || questionExpandedByUser;

  questionCardEl.classList.toggle("hidden", !hasContent || !showQuestion);

  if (questionToggleBtn) {
    questionToggleBtn.classList.toggle("hidden", !useAnswersOnlyDefault);
    questionToggleBtn.textContent = showQuestion ? "Q on" : "Q";
    questionToggleBtn.title = showQuestion ? "Hide question" : "Show question";
    questionToggleBtn.setAttribute("aria-pressed", showQuestion ? "true" : "false");
    questionToggleBtn.classList.toggle("active", showQuestion);
  }
}

function resetQuestionVisibilityDefault() {
  questionExpandedByUser = loadQuestionVisibilityPreference();
  updateQuestionCardVisibility();
}

function answerLetter(index) {
  const letters = ["A", "B", "X", "Y"];
  return Number.isInteger(index) && index >= 0 && index < letters.length ? letters[index] : "?";
}

function showLockedPanel(index, skipped = false) {
  if (lockChoiceEl) lockChoiceEl.textContent = skipped ? "SKIP" : answerLetter(index);
  if (questionMetaEl) questionMetaEl.textContent = `${playerName || "Player"} • Answer locked`;
  updateLifelineButtons();
  if (lockPanel) show(lockPanel);
}

function showFeedbackPanel(outcome) {
  feedbackShownAt = Date.now();
  if (!feedbackPanel) return;

  if (feedbackIconEl) {
    if (outcome === "correct") {
      feedbackIconEl.textContent = "✓";
      feedbackIconEl.style.background = "#22c55e";
      feedbackIconEl.style.boxShadow = "0 0 38px rgba(34, 197, 94, 0.34)";
    } else if (outcome === "wrong") {
      feedbackIconEl.textContent = "✕";
      feedbackIconEl.style.background = "#f43f5e";
      feedbackIconEl.style.boxShadow = "0 0 38px rgba(244, 63, 94, 0.34)";
    } else {
      feedbackIconEl.textContent = "⏱";
      feedbackIconEl.style.background = "#f59e0b";
      feedbackIconEl.style.boxShadow = "0 0 38px rgba(245, 158, 11, 0.34)";
    }
  }

  if (feedbackTitleEl) {
    feedbackTitleEl.textContent = outcome === "correct" ? "Correct!" : (outcome === "wrong" ? "Wrong!" : "Time's up!");
  }
  if (feedbackSubEl) {
    feedbackSubEl.textContent = outcome === "correct"
      ? "Great hit. Keep the momentum."
      : (outcome === "wrong" ? "No stress. Next question can flip it." : "No answer recorded for this round.");
  }

  show(feedbackPanel);
}

function toast(msg, duration = 2000) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), duration);
}

function playClick() {
  if (!clickSfx) return;
  try { clickSfx.currentTime = 0; clickSfx.play(); } catch {}
}

function updateAvatarPreviews() {
  // Join-screen picker uses the general image from avatarFiles array
  const generalSrc = (avatarIndex !== null && avatarFiles[avatarIndex]) ? avatarFiles[avatarIndex] : "";
  // In-game panels use the current state image
  const stateSrc = avatarIndex !== null ? getAvatarSrc(_avatarState) : generalSrc;
  if (avatarWait) avatarWait.src = stateSrc || generalSrc;
  if (avatarPlay) avatarPlay.src = stateSrc || generalSrc;
  if (endAvatarEl) endAvatarEl.src = generalSrc; // end screen uses general unless overridden
}

function setAvatarIndex(index) {
  if (!avatarButtons || avatarButtons.length === 0) {
    avatarIndex = null;
    updateAvatarPreviews();
    return;
  }

  if (!Number.isInteger(index)) {
    avatarIndex = null;
  } else {
    const maxIndex = avatarButtons.length - 1;
    avatarIndex = Math.max(0, Math.min(index, maxIndex));
  }

  avatarButtons.forEach(btn => {
    const i = Number(btn.dataset.avatar);
    const selected = avatarIndex !== null && i === avatarIndex;
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.classList.toggle("ring-2", selected);
    btn.classList.toggle("ring-yellow-400", selected);
    btn.classList.toggle("border-yellow-500", selected);
    btn.classList.toggle("shadow-lg", selected);
    btn.classList.toggle("opacity-100", selected);
    btn.classList.toggle("opacity-70", !selected);
  });
  updateAvatarPreviews();
}

function initAvatarPicker() {
  if (!avatarPicker) return;
  avatarPicker.innerHTML = "";
  avatarButtons = [];

  for (let i = 0; i < avatarFiles.length; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatarBtn rounded-2xl border border-slate-700 bg-slate-900/80 p-1 transition-all";
    btn.dataset.avatar = String(i);
    btn.setAttribute("aria-pressed", "false");

    const img = document.createElement("img");
    img.src = avatarFiles[i];
    img.alt = `Avatar ${i + 1}`;
    img.className = "w-full h-14 object-cover rounded-xl";
    btn.appendChild(img);

    btn.addEventListener("click", () => {
      playClick();
      setAvatarIndex(Number(btn.dataset.avatar));
    });

  avatarPicker.appendChild(btn);
  avatarButtons.push(btn);
  }

  setAvatarIndex(avatarIndex);
}

async function loadAvatars() {
  try {
    const res = await fetch("/api/avatars");
    if (!res.ok) throw new Error("avatar list failed");
    const data = await res.json();
    if (Array.isArray(data.files) && data.files.length > 0) {
      avatarFiles = data.files;
    }
  } catch (e) {
    // fallback to built-in list
  }
  initAvatarPicker();
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function renderTopPlayers(el, topPlayers, fallbackTopNames, fallbackTopName) {
  if (!el) return;

  // Normalise topPlayers — accept array or Firebase object-with-numeric-keys
  let players = [];
  if (Array.isArray(topPlayers) && topPlayers.length > 0) {
    players = topPlayers.slice(0, 3);
  } else if (topPlayers && typeof topPlayers === "object") {
    players = Object.values(topPlayers).slice(0, 3);
  }

  // Fall back to topNames array when no scorePoints data is available
  if (players.length === 0) {
    const names = Array.isArray(fallbackTopNames) && fallbackTopNames.length > 0
      ? fallbackTopNames.slice(0, 3).filter(Boolean)
      : (fallbackTopName ? [fallbackTopName] : []);
    players = names.map((n, i) => ({ rank: i + 1, name: n, scorePoints: null }));
  }

  if (players.length === 0) { el.innerHTML = "-"; return; }

  const medalColors = ["#fbbf24", "#94a3b8", "#cd7c3a"];
  const lines = players.map((p, i) => {
    const medal = RANK_MEDALS[i] || `#${i + 1}`;
    const nameColor = medalColors[i] || "#f8fafc";
    const pts = typeof p.scorePoints === "number"
      ? ` <span style="color:#9fb2d1;font-size:0.82em;font-weight:600">${p.scorePoints.toLocaleString()} pts</span>`
      : "";
    return `<div style="display:flex;align-items:center;gap:6px;line-height:1.7">`
      + `<span style="font-size:1.2em">${medal}</span>`
      + `<strong style="color:${nameColor}">${escapeHtml(String(p.name || ""))}</strong>`
      + pts
      + `</div>`;
  });
  el.innerHTML = lines.join("");
}

function isPlayerTopScorer(topPlayers, fallbackTopNames, fallbackTopName, myName) {
  let names = [];
  if (Array.isArray(topPlayers) && topPlayers.length > 0) {
    names = topPlayers.slice(0, 3).map(p => p.name || "");
  } else if (topPlayers && typeof topPlayers === "object") {
    names = Object.values(topPlayers).slice(0, 3).map(p => p.name || "");
  }
  if (names.length === 0) {
    names = Array.isArray(fallbackTopNames) && fallbackTopNames.length > 0
      ? fallbackTopNames.slice(0, 3).filter(Boolean)
      : (fallbackTopName ? [fallbackTopName] : []);
  }
  return names.includes(myName);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function createConfetti() {
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.background = ['#fbbf24', '#10b981', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 4)];
      confetti.style.animationDelay = Math.random() * 0.3 + 's';
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3000);
    }, i * 30);
  }
}

function updateStreak(isCorrect) {
  if (isCorrect) {
    currentStreak++;
    if (currentStreak >= 3) {
      streakCount.textContent = currentStreak;
      streakBadge.classList.remove('hidden');
      createConfetti();
    }
  } else {
    currentStreak = 0;
    streakBadge.classList.add('hidden');
  }
  saveSession();
}

function flashColor(kind) {
  flash.className = "fixed inset-0 transition-opacity duration-300";
  flash.classList.remove("hidden");

  if (kind === "correct") {
    flash.classList.add("bg-emerald-500/70");
    updateStreak(true);
  } else if (kind === "wrong") {
    flash.classList.add("bg-rose-500/70");
    updateStreak(false);
  } else {
    flash.classList.add("bg-orange-400/70");
    updateStreak(false);
  }

  setTimeout(() => flash.classList.add("hidden"), 650);
}

function enableAnswerButtons(enabled) {
  document.querySelectorAll(".ansBtn").forEach(btn => {
    btn.disabled = !enabled || paused;
    btn.classList.toggle("opacity-60", !enabled || paused);
  });
}

function highlightSelectedAnswer(index) {
  document.querySelectorAll(".ansBtn").forEach((btn, i) => {
    if (i === index) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
}

function clearAnswerHighlights() {
  document.querySelectorAll(".ansBtn").forEach(btn => {
    btn.classList.remove("selected");
  });
}

function setQuestionText(text) {
  if (!qText) return;
  const value = (text || "").trim();
  if (value) {
    qText.textContent = value;
    qText.classList.remove("hidden");
  } else {
    qText.textContent = "";
    qText.classList.add("hidden");
  }
  updateQuestionCardVisibility();
}

function setOptions(options) {
  const btns = document.querySelectorAll(".ansBtn");
  for (let i = 0; i < btns.length; i++) {
    const btn = btns[i];
    const label = btn.querySelector(".answerText");
    if (label) {
      const value = options && options[i] ? String(options[i]).trim() : "";
      label.textContent = value;
      label.classList.toggle("hidden", !value);
    }
  }
}

function setQuestionImage(src) {
  if (!qImage) return;
  const value = (src || "").trim();
  if (value) {
    qImage.src = value;
    qImage.classList.remove("hidden");
  } else {
    qImage.removeAttribute("src");
    qImage.classList.add("hidden");
  }
  updateQuestionCardVisibility();
}

function setOptionImages(images) {
  const btns = document.querySelectorAll(".ansBtn");
  for (let i = 0; i < btns.length; i++) {
    const img = btns[i].querySelector(".answerImage");
    if (!img) continue;
    const src = images && images[i] ? String(images[i]).trim() : "";
    if (src) {
      img.src = src;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
  }
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
  timerEl.textContent = "--";
}

function startTimer(durationMs) {
  stopTimer();
  if (!durationMs || durationMs <= 0) { 
    timerEl.textContent = "∞"; 
    return; 
  }

  timerEndsAt = Date.now() + durationMs;

  const tick = () => {
    if (paused) return;
    const left = Math.max(0, timerEndsAt - Date.now());
    const sec = Math.ceil(left / 1000);
    timerEl.textContent = `${sec}`;
    
    // Warning color when time is low
    if (sec <= 5) {
      timerEl.classList.add('text-red-400', 'shake');
    } else {
      timerEl.classList.remove('text-red-400', 'shake');
    }
    
    if (left <= 0) stopTimer();
  };

  tick();
  timerHandle = setInterval(tick, 100);
}

function setScores(c, w, m, points = null) {
  scoreCorrect = c; scoreWrong = w; scoreMissed = m;
  if (typeof points === "number" && Number.isFinite(points)) {
    scorePoints = points;
  }
  scoreCorrectEl.textContent = String(scoreCorrect);
  scoreWrongEl.textContent = String(scoreWrong);
  scoreMissedEl.textContent = String(scoreMissed);
  if (endCorrectEl) endCorrectEl.textContent = String(scoreCorrect);
  if (endWrongEl) endWrongEl.textContent = String(scoreWrong);
  if (endMissedEl) endMissedEl.textContent = String(scoreMissed);
  if (endScoreEl) endScoreEl.textContent = String(scorePoints);
  saveSession();
}

function send(obj) {
  if (useFirebase) return false;
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[WS Send]", obj);
    ws.send(JSON.stringify(obj));
    return true;
  } else {
    console.warn("[WS Send] Not connected, attempting reconnect...");
    if (obj && obj.type === "JOIN") {
      toast("⚠️ Connecting to server. Please wait...", 2200);
    }
    if (gameActive) reconnect();
    return false;
  }
}

function showReconnecting(show) {
  if (show) {
    connectionStatus.classList.remove('hidden');
    isReconnecting = true;
  } else {
    connectionStatus.classList.add('hidden');
    isReconnecting = false;
  }
}

function reconnect() {
  if (isReconnecting) return;
  if (!room || !playerId || !playerName || !gameActive) return;
  
  console.log('[Reconnect] Attempting to reconnect...');
  showReconnecting(true);
  
  if (reconnectTimer) clearTimeout(reconnectTimer);
  
  if (reconnectAttempts >= maxReconnectAttempts) {
    toast('❌ Connection lost. Please rejoin.', 5000);
    clearSession();
    show(joinPanel);
    joinBtn.disabled = false;
    showReconnecting(false);
    return;
  }
  
  reconnectAttempts++;
  
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
  
  reconnectTimer = setTimeout(() => {
    connect(true);
  }, delay);
}

function connect(isReconnect = false) {
  if (useFirebase) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  
  setStatus("Connecting...");

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    console.log("[WS] Connected");
    setStatus("Connected ✅");
    reconnectAttempts = 0;
    showReconnecting(false);
    
    if (isReconnect && room && playerId && playerName) {
      // Re-join with same credentials
      console.log('[Reconnect] Re-joining room...');
      send({ 
        type: "JOIN", 
        room, 
        name: playerName,
        playerId,
        avatarIndex
      });
    } else if (queuedJoinPayload) {
      const payload = queuedJoinPayload;
      queuedJoinPayload = null;
      send(payload);
    }
  };
  
  ws.onclose = () => {
    console.log("[WS] Disconnected");
    setStatus("Disconnected");

    const wasJoining = joinInProgress;
    if (joinInProgress) {
      clearJoinResponseTimeout();
      joinInProgress = false;
      joinBtn.disabled = false;
    }

    if (gameActive && room && playerId && playerName) {
      toast('⚠️ Connection lost, reconnecting...', 2000);
      reconnect();
    } else if (wasJoining) {
      toast("❌ Could not reach server. Try again.", 3200);
    }
  };

  ws.onerror = (err) => {
    console.error("[WS Error]", err);
    setStatus("Connection error");
    if (joinInProgress) {
      joinBtn.disabled = false;
      clearJoinResponseTimeout();
      toast("❌ Connection error while joining.", 3200);
    }
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    console.log("[WS Receive]", msg);

    if (msg.type === "JOIN_OK") {
      clearJoinResponseTimeout();
      room = msg.room;
      playerId = msg.playerId;
      playerName = msg.name;
      resetQuestionVisibilityDefault();
      if (Number.isInteger(msg.avatarIndex)) {
        avatarIndex = msg.avatarIndex;
        setAvatarIndex(avatarIndex);
      }
      gameActive = true;
      updateAvatarPreviews();

      playerLabel.textContent = `${playerName}`;
      if (waitRoomCodeEl) waitRoomCodeEl.textContent = room;
      if (questionMetaEl) questionMetaEl.textContent = `${playerName || "Player"} • Waiting`;
      setWaitPanelState(msg.isRejoin ? "between" : "joined");
      show(waitPanel);
      setStatus(`Connected ✅ Room ${room}`);
      
      if (msg.isRejoin) {
        toast("✅ Reconnected successfully!");
        // Restore scores from server response
        if (typeof msg.scoreCorrect === 'number') {
          setScores(msg.scoreCorrect, msg.scoreWrong, msg.scoreMissed, msg.scorePoints);
        }
      } else {
        toast("✅ Joined successfully!");
      }
      lifelineUnlocked = !!msg.lifelineUnlocked;
      lifelineConsumed = !!msg.lifelineConsumed;
      updateLifelineButtons();
      
      saveSession();
      requestWakeLock();
      return;
    }

    if (msg.type === "JOIN_FAIL") {
      clearJoinResponseTimeout();
      const reason = msg.reason || "Unknown";

      // Bug fix: if the player was already mid-game and gets NO_HOST (Render server restarted)
      // or ROOM_LOCKED (server lost state and can't match the playerId), DON'T wipe the session.
      // The host is likely reconnecting too — retry after a short delay.
      if (reason === "NO_HOST" && gameActive && room && playerId) {
        setStatus("⏳ Waiting for host...");
        toast("⏳ Host reconnecting — retrying in 4s", 3500);
        setTimeout(() => { if (gameActive) connect(true); }, 4000);
        return;
      }
      if (reason === "ROOM_LOCKED" && gameActive && room && playerId) {
        // Server may have restarted with a locked room and lost our playerId — retry.
        setStatus("⏳ Rejoining locked room...");
        setTimeout(() => { if (gameActive) connect(true); }, 3000);
        return;
      }

      setStatus(`Join failed: ${reason}`);
      joinBtn.disabled = false;
      if (reason === "ROOM_FULL") {
        toast("🚫 Room full (36 players). Please wait or join next round.", 4000);
      } else if (reason === "NO_HOST") {
        toast("❌ Room not available. Check the room code.", 3500);
      } else if (reason === "ROOM_LOCKED") {
        toast("🔒 Room is locked right now.", 3200);
      } else {
        toast(`❌ ${reason}`);
      }

      if (reason === "ROOM_LOCKED" || reason === "NO_HOST") {
        clearSession();
        show(joinPanel);
      }
      return;
    }

    if (msg.type === "ROOM_LOCKED") { 
      toast("🔒 Room locked by host"); 
      return; 
    }
    
    if (msg.type === "ROOM_UNLOCKED") { 
      toast("🔓 Room unlocked"); 
      return; 
    }

    if (msg.type === "PAUSE") {
      paused = !!msg.paused;
      if (paused) toast("⏸️ Paused by host");
      else toast("▶️ Resumed");
      enableAnswerButtons(!hasAnswered && !!activeQuestionId);
      return;
    }

    if (msg.type === "REACTION_BURST") {
      if (msg.emoji) showReactionBurst(String(msg.emoji || ""), "");
      return;
    }

    if (msg.type === "TOP_MOVERS") {
      showTopMovers(msg.movers || []);
      return;
    }

    if (msg.type === "CLUTCH_HIGHLIGHT") {
      const name = String(msg.name || "A player");
      toast(`⚡ Clutch: ${name} was the only correct answer!`, 3000);
      return;
    }

    if (msg.type === "ANSWER_HEATMAP") {
      if (!activeQuestionId || msg.questionId !== activeQuestionId) return;
      renderHeatmap(msg.counts || [], msg.total || 0);
      return;
    }
    if (msg.type === "LIFELINE_ACK") {
      if (!msg.accepted) {
        toast(`❌ Lifeline unavailable (${msg.reason || "not allowed"})`, 2000);
        return;
      }
      const kind = String(msg.lifeline || "").toLowerCase();
      lifelineConsumed = true;
      lifelineUnlocked = false;
      updateLifelineButtons();
      if (kind === "double") toast("✨ Double armed for this question!", 2200);
      else if (kind === "skip") toast("⏭️ Skip used", 1800);
      else if (kind === "fifty") toast("✂️ 50/50 activated", 1800);
      return;
    }

    if (msg.type === "LIFELINE_EFFECT") {
      const kind = String(msg.lifeline || "").toLowerCase();
      if (kind === "fifty") {
        applyFiftyEliminate(msg.eliminate || []);
      }
      return;
    }

    if (msg.type === "QUESTION_START") {
      gameActive = true; // re-enter active game (covers replay after GAME_END)
      setAvatarState(currentStreak >= 3 ? "steak" : "general", 0);
      clearPendingWaitPanelTransition();
      activeQuestionId = msg.questionId;
      hasAnswered = false;
      pendingAnswer = -1;
      resetHeatmap();
      resetAnswerButtonVisibility();
      resetQuestionVisibilityDefault();
      lockMsg.classList.add("hidden");
      clearAnswerHighlights();
      enableAnswerButtons(true);
      updateLifelineButtons();

      setQuestionText(msg.questionText || "");
      setOptions(msg.options || []);
      setQuestionImage(msg.questionImage || "");
      setOptionImages(msg.optionImages || []);
      if (questionMetaEl) questionMetaEl.textContent = `${playerName || "Player"} • Question live`;
      setStatus(`Question active ✅`);
      toast("📝 Answer now!");

      startTimer(msg.durationMs || 0);
      show(questionPanel);
      
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      saveSession();
      return;
    }

    if (msg.type === "ANSWER_ACK") {
      if (msg.accepted) {
        hasAnswered = true;
      if (Number.isInteger(Number(msg.choiceIndex))) {
        pendingAnswer = Number(msg.choiceIndex);
      }
        lockMsg.classList.remove("hidden");
        lockMsg.querySelector('div').textContent = "✅ Submitted";
        enableAnswerButtons(false);
        
        if (pendingAnswer >= 0) {
          highlightSelectedAnswer(pendingAnswer);
        }
        showLockedPanel(pendingAnswer, !!msg.skipped);
        updateLifelineButtons();
        
        toast("✅ Answer received!", 2000);
        console.log(`[Answer] Confirmed: Option ${pendingAnswer + 1}`);
        
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      } else {
        hasAnswered = false;
        pendingAnswer = -1;
        lockMsg.classList.add("hidden");
        enableAnswerButtons(true);
        clearAnswerHighlights();
        show(questionPanel);
        updateLifelineButtons();
        setStatus(`Answer rejected: ${msg.reason}`);
        toast(`❌ ${msg.reason}`);
      }
      return;
    }

    if (msg.type === "ANSWER_FEEDBACK") {
      const outcome = normalizeOutcome(msg.outcome || msg.status);
      flashColor(outcome);
      showFeedbackPanel(outcome);
      if (typeof msg.streak === "number") {
        currentStreak = Math.max(0, Number(msg.streak || 0));
        if (currentStreak >= 3) {
          streakCount.textContent = currentStreak;
          streakBadge.classList.remove('hidden');
        } else {
          streakBadge.classList.add('hidden');
        }
      }

      // Avatar state: show correct/wrong for 3s, then settle on steak or general
      if (outcome === "correct") {
        setAvatarState("correct", 3000);
      } else {
        setAvatarState("wrong", 3000);
      }
      
      const messages = {
        correct: "🎉 Correct!",
        wrong: "❌ Wrong",
        missed: "⏱️ Time's up"
      };
      
      toast(messages[outcome] || "Result", 2500);

      if (typeof msg.scoreCorrect === "number") {
        setScores(msg.scoreCorrect, msg.scoreWrong, msg.scoreMissed, msg.scorePoints);
      }
      if (msg.pointsGained > 0) {
        toast(`+${msg.pointsGained} pts`, 1700);
      }
      if (msg.speedBonus > 0) {
        toast(`⚡ Speed bonus +${msg.speedBonus}`, 1900);
      }
      if (msg.lifelineBonus > 0) {
        toast(`✨ Double bonus +${msg.lifelineBonus}`, 1900);
      }
      showMilestones(msg.milestones || []);
      lifelineUnlocked = !!msg.lifelineUnlocked;
      lifelineConsumed = !!msg.lifelineConsumed;
      updateLifelineButtons();
      
      if (navigator.vibrate) {
        if (outcome === "correct") {
          navigator.vibrate([100, 50, 100, 50, 100]);
        } else {
          navigator.vibrate(300);
        }
      }
      
      clearAnswerHighlights();
      return;
    }

    if (msg.type === "ROUND_END") {
      clearPendingWaitPanelTransition();
      stopTimer();
      activeQuestionId = null;
      hasAnswered = false;
      pendingAnswer = -1;
      resetHeatmap();
      resetAnswerButtonVisibility();
      updateLifelineButtons();
      clearAnswerHighlights();
      setQuestionImage("");
      setOptionImages([]);
      setQuestionText("");
      lockMsg.classList.add("hidden");
      const elapsed = Date.now() - feedbackShownAt;
      const delay = (feedbackPanel && !feedbackPanel.classList.contains("hidden")) ? Math.max(0, 900 - elapsed) : 0;
      scheduleWaitPanelTransition(delay, "⏳ Next question coming...");
      return;
    }

    if (msg.type === "SCORE_RESET") {
      // Scores reset = new game starting. Re-activate and return to wait screen.
      setAvatarState("general", 0);
      gameActive = true;
      activeQuestionId = null;
      hasAnswered = false;
      pendingAnswer = -1;
      lastFirebaseResultToken = "";
      setScores(0, 0, 0, 0);
      currentStreak = 0;
      streakBadge.classList.add("hidden");
      lifelineUnlocked = false;
      lifelineConsumed = false;
      updateLifelineButtons();
      setWaitPanelState("between");
      show(waitPanel);
      toast("🔄 New game starting!", 2000);
      return;
    }

    if (msg.type === "GAME_END") {
      clearPendingWaitPanelTransition();
      stopTimer();
      activeQuestionId = null;
      hasAnswered = false;
      pendingAnswer = -1;
      clearAnswerHighlights();
      gameActive = false; // Mark game as ended

      endNameEl.textContent = msg.name || playerName || "Player";
      const pid = msg.playerId ? `ID ${msg.playerId.slice(0, 6)}` : "";
      const date = msg.date || "";
      endMetaEl.textContent = [pid, date].filter(Boolean).join(" · ");
      endTotalQEl.textContent = String(msg.totalQuestions || 0);
      endRoundsEl.textContent = String(msg.rounds || 0);
      renderTopPlayers(endTopEl, msg.topPlayers, msg.topNames, msg.topName);
      if (typeof msg.correct === "number" || typeof msg.wrong === "number" || typeof msg.missed === "number") {
        setScores(Number(msg.correct || 0), Number(msg.wrong || 0), Number(msg.missed || 0), Number(msg.scorePoints || 0));
      }
      if (endCorrectEl) endCorrectEl.textContent = String(scoreCorrect);
      if (endWrongEl) endWrongEl.textContent = String(scoreWrong);
      if (endMissedEl) endMissedEl.textContent = String(scoreMissed);
      if (endScoreEl) endScoreEl.textContent = String(scorePoints);

      show(endPanel);
      setStatus("🏁 Quiz finished!");

      if (isPlayerTopScorer(msg.topPlayers, msg.topNames, msg.topName, playerName)) {
        setAvatarState("win", 0);
        if (endAvatarEl) endAvatarEl.src = getAvatarSrc("win");
        createConfetti();
        toast("🏆 You're a winner!", 5000);
      } else {
        setAvatarState("general", 0);
      }
      
      // DON'T clear session yet - player is still connected
      // Only clear when they explicitly leave
      return;
    }
  };
}

// Call loadAvatars, then apply test-mode pre-fill once the picker is ready.
// Using .then() avoids the JS hoisting trap that would occur if we redeclared
// the function — function declarations are hoisted and the last one wins,
// so _origLoadAvatars would capture the override itself causing infinite recursion.
loadAvatars().then(() => {
  if (!TEST_MODE) return;
  if (roomInput && TEST_ROOM) roomInput.value = TEST_ROOM;
  if (nameInput && TEST_NAME) nameInput.value = TEST_NAME;
  if (Number.isFinite(TEST_AVATAR)) setAvatarIndex(TEST_AVATAR);
  if (TEST_AUTOJOIN) {
    const delay = useFirebase ? 2800 : 1200;
    setTimeout(() => { if (joinBtn && !joinBtn.disabled) joinBtn.click(); }, delay);
  }
});
resetQuestionVisibilityDefault();
resetHeatmap();
updateLifelineButtons();

if (questionToggleBtn) {
  questionToggleBtn.addEventListener("click", () => {
    playClick();
    questionExpandedByUser = !questionExpandedByUser;
    saveQuestionVisibilityPreference(questionExpandedByUser);
    updateQuestionCardVisibility();
  });
}

if (phoneAnswersOnlyMedia) {
  const onMediaChange = () => resetQuestionVisibilityDefault();
  if (typeof phoneAnswersOnlyMedia.addEventListener === "function") {
    phoneAnswersOnlyMedia.addEventListener("change", onMediaChange);
  } else if (typeof phoneAnswersOnlyMedia.addListener === "function") {
    phoneAnswersOnlyMedia.addListener(onMediaChange);
  }
}

if (lifelineFiftyBtn) {
  lifelineFiftyBtn.addEventListener("click", () => {
    playClick();
    useLifeline("fifty");
  });
}

if (lifelineSkipBtn) {
  lifelineSkipBtn.addEventListener("click", () => {
    playClick();
    useLifeline("skip");
  });
}

if (lifelineDoubleBtn) {
  lifelineDoubleBtn.addEventListener("click", () => {
    playClick();
    useLifeline("double");
  });
}

if (reactionRow) {
  reactionRow.querySelectorAll(".emoji-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      playClick();
      const emoji = String(btn.dataset.emoji || "").trim();
      if (!emoji || !room) return;
      if (useFirebase) {
        if (!fbRoomRef || !playerId) {
          toast("❌ Not connected", 1500);
          return;
        }
        if (activeQuestionId) {
          toast("Reactions open between questions.", 1600);
          return;
        }
        showReactionBurst(emoji, "");
        fbRoomRef.child("reactions").push({
          playerId,
          emoji,
          t: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {
          toast("❌ Reaction failed", 1500);
        });
        return;
      }
      if (activeQuestionId) {
        toast("Reactions open between questions.", 1600);
        return;
      }
      showReactionBurst(emoji, "");
      send({ type: "REACTION", room, emoji });
    });
  });
}

// Join button
joinBtn.addEventListener("click", () => {
  playClick();
  requestWakeLock();
  const r = roomInput.value.trim().toUpperCase();
  const n = nameInput.value.trim();
  if (!r || !n) { 
    setStatus("⚠️ Enter room code and name."); 
    roomInput.classList.add('shake');
    setTimeout(() => roomInput.classList.remove('shake'), 500);
    return; 
  }
  if (avatarIndex === null) {
    setStatus("⚠️ Select an avatar.");
    toast("⚠️ Please select an avatar.", 2000);
    return;
  }

  joinBtn.disabled = true;
  playerName = n;
  startJoinResponseTimeout();
  if (useFirebase) {
    firebaseJoin(r, n, avatarIndex);
  } else {
    const joinPayload = { type: "JOIN", room: r, name: n, avatarIndex };
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (!send(joinPayload)) {
        queuedJoinPayload = joinPayload;
        connect(false);
      }
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      queuedJoinPayload = joinPayload;
      setStatus("Connecting...");
      toast("⏳ Connecting to server...", 2200);
    } else {
      queuedJoinPayload = joinPayload;
      setStatus("Connecting...");
      connect(false);
      toast("⏳ Connecting to server...", 2200);
    }
  }
});

// Answer buttons
document.querySelectorAll(".ansBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    playClick();
    if (!activeQuestionId || hasAnswered || paused) return;

    const i = Number(btn.dataset.i);
    pendingAnswer = i;
    
    lockMsg.classList.remove("hidden");
    lockMsg.querySelector('div').textContent = "📤 Sending...";
    enableAnswerButtons(false);

    console.log(`[Answer] Submitting option ${i + 1} for question ${activeQuestionId}`);
    if (useFirebase) {
      if (fbRoomRef && playerId) {
        pendingResultQuestionId = activeQuestionId || "";
        hasAnswered = true;
        const _answerPayload = {
          questionId: activeQuestionId || "",
          choiceIndex: i,
          t: firebase.database.ServerValue.TIMESTAMP
        };
        const _answerTimeout = new Promise((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), 8000)
        );
        Promise.race([
          fbRoomRef.child("answers").child(playerId).set(_answerPayload),
          _answerTimeout
        ]).then(() => {
          lockMsg.classList.remove("hidden");
          lockMsg.querySelector('div').textContent = "✅ Submitted";
          enableAnswerButtons(false);
          if (pendingAnswer >= 0) {
            highlightSelectedAnswer(pendingAnswer);
          }
          showLockedPanel(pendingAnswer);
          toast("✅ Answer sent!", 1500);
        }).catch((err) => {
          console.error("[Firebase] Answer submit failed:", err);
          hasAnswered = false;
          pendingAnswer = -1;
          lockMsg.classList.add("hidden");
          enableAnswerButtons(true);
          clearAnswerHighlights();
          show(questionPanel);
          setStatus("❌ Answer failed");
          toast(err.message === "timeout" ? "❌ Server timeout. Try again." : "❌ Answer failed", 1500);
        });
      } else {
        toast("❌ Not connected", 1500);
      }
    } else {
      send({ type: "ANSWER_SUBMIT", questionId: activeQuestionId, choiceIndex: i });
    }
  });
});

// Leave button - COMPLETELY clear session
if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    playClick();
    
    // Send leave message to server
    if (useFirebase) {
      if (fbRoomRef && playerId) {
        fbRoomRef.child("players").child(playerId).remove();
      }
      fbClearListeners();
    } else {
      send({ type: "LEAVE", room });
    }
    
    // Clear all session data
    clearSession();
    
    // Reset UI
    setStatus("👋 You left the room.");
    setScores(0, 0, 0, 0);
    streakBadge.classList.add('hidden');
    
    // Close WebSocket
    if (ws) {
      ws.close();
      ws = null;
    }
    
    // Show join panel
    show(joinPanel);
    joinBtn.disabled = false;
  });
}

function gracefulLeave() {
  if (useFirebase) {
    if (fbRoomRef && playerId) {
      try { fbRoomRef.child("players").child(playerId).remove(); } catch {}
    }
    fbClearListeners();
    return;
  }
  if (room && ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ type: "LEAVE", room })); } catch {}
  }
  try {
    if (ws) ws.close();
  } catch {}
}

// gracefulLeave only on pagehide (fires when page actually unloads).
// Removed from beforeunload — if we also ran it there, the LEAVE would be sent
// to the server BEFORE the "are you sure?" dialog, so clicking "Stay" would still
// mark the player as inactive on the server.
window.addEventListener("pagehide", gracefulLeave);

// Auto-fill room from URL
const params = new URLSearchParams(location.search);
const roomFromUrl = params.get("room")?.toUpperCase();
if (roomFromUrl) {
  roomInput.value = roomFromUrl;
}

// On page load, restore session and rejoin automatically where possible.
window.addEventListener('load', () => {

  // ── Firebase path ──────────────────────────────────────────────────────────
  if (useFirebase) {
    if (!initFirebase()) return;

    // Bug fix: Firebase path previously returned immediately without checking
    // localStorage, so every page refresh forced a manual re-join.
    if (loadSession() && room && playerName && avatarIndex !== null) {
      console.log('[Init] Firebase session found — rejoining room', room);
      firebaseJoin(room, playerName, avatarIndex);
    } else {
      if (roomFromUrl) roomInput.value = roomFromUrl;
    }
    return;
  }

  // ── WebSocket path ─────────────────────────────────────────────────────────
  if (roomFromUrl) {
    const saved = localStorage.getItem('quizSession');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        const age = Date.now() - (s.timestamp || 0);
        const fresh = age < 30 * 60 * 1000;

        if (s.room === roomFromUrl && fresh) {
          // Bug fix: same room URL + valid session → restore state and auto-rejoin
          // (previously called connect(false) which never sent the JOIN, so the player
          // got a new playerId and created a duplicate entry on the server).
          console.log('[Init] Same-room session found — auto-rejoining', roomFromUrl);
          loadSession();
          connect(true);  // ws.onopen will send JOIN with the existing playerId
          return;
        } else if (s.room && s.room !== roomFromUrl) {
          clearSession();  // Different room — start fresh
        }
      } catch {
        clearSession();
      }
    }
    connect(false);  // No session — player fills the form
    return;
  }

  // No URL room code — restore any saved session
  if (loadSession()) {
    console.log('[Init] Session found, reconnecting...');
    connect(true);
  } else {
    connect(false);
  }
});

// Warn before accidental tab close / refresh during active game
window.addEventListener('beforeunload', (e) => {
  if (gameActive) {
    const msg = 'The quiz is still running — leaving will disconnect you!';
    e.preventDefault();
    e.returnValue = msg;
    return msg;
  }
});

// Periodic session save every 15 s so the latest scores survive a crash/refresh
setInterval(() => { if (gameActive) saveSession(); }, 15000);

// Heartbeat to keep connection alive
if (!useFirebase) {
  setInterval(() => {
    if (gameActive && room && playerId) {
      send({ type: "PING" });
    }
  }, 5000);
}



