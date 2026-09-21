(() => {
  const STORAGE_KEY = "icebreak-duel-v1";
  const GLOBAL_MS = 20 * 60 * 1000;

  const ROUNDS = [
    { id: 1, name: "這或那", ms: 2 * 60 * 1000, itemMs: 20 * 1000 },
    { id: 2, name: "最有可能", ms: 3.5 * 60 * 1000, itemMs: 60 * 1000 },
    { id: 3, name: "30秒認識你", ms: 3 * 60 * 1000, itemMs: 30 * 1000 },
    { id: 4, name: "做我估", ms: 4 * 60 * 1000, itemMs: 45 * 1000 },
    { id: 5, name: "搶答", ms: 3 * 60 * 1000, itemMs: null },
    { id: 6, name: "終極介紹", ms: 2.5 * 60 * 1000, itemMs: 60 * 1000 },
  ];

  const PACKS = {
    family: {
      thisOrThat: [
        ["茶檔", "咖啡店"],
        ["山", "海"],
        ["火鍋", "燒烤"],
        ["貓", "狗"],
        ["計劃旅行", "即興出發"],
        ["提早到", "剛剛好"],
        ["出街食", "外賣"],
        ["早睡", "夜貓"],
        ["窗邊", "走廊"],
        ["睇戲", "行街"],
      ],
      likely: [
        "最有可能遲到",
        "最有可能袋住充電線但自己電話沒電",
        "最有可能食辣會喊",
        "最有可能旅行手信買到超重",
        "最有可能記住所有人生日",
        "最有可能帶錯嘢出門",
        "最有可能係隱藏美食家",
        "最有可能第一個去排隊",
        "最有可能迷路",
        "最有可能手機長期5%",
      ],
    },
    friends: {
      thisOrThat: [
        ["計劃旅行", "即興出發"],
        ["提早到", "剛剛好"],
        ["出街食", "外賣"],
        ["早睡", "夜貓"],
        ["窗邊", "走廊"],
        ["睇戲", "行街"],
        ["行山", "karaoke"],
        ["通宵傾偈", "早瞓養身"],
        ["影相打卡", "低調享受"],
        ["大枱食飯", "細細隊"],
        ["火鍋", "燒烤"],
        ["茶檔", "咖啡店"],
      ],
      likely: [
        "最有可能凌晨3點仲醒",
        "最有可能一唱歌全場靜",
        "最有可能袋住充電線但自己電話沒電",
        "最有可能旅行手信買到超重",
        "最有可能手機長期5%",
        "最有可能遲到",
        "最有可能帶錯嘢出門",
        "最有可能迷路",
        "最有可能食辣會喊",
        "最有可能係隱藏美食家",
        "最有可能記住所有人生日",
        "最有可能第一個去排隊",
      ],
    },
  };

  const CHARADES = [
    "行山", "火鍋", "karaoke", "加班", "打機", "湊貓", "影相",
    "遲到", "飲茶", "坐飛機", "第一次見面", "旅行失散", "手機沒電", "唔識用冷氣遙控",
  ];

  const BUZZER_PROMPTS = [
    "用一個詞形容今晚氣氛",
    "講一件自己今日發生嘅小事",
    "推薦一個香港地方俾新認識嘅人",
    "隊長而家袋裏最奇怪嘅物件係咩（口頭答）",
    "你們隊最快可以想出一個隊呼",
  ];

  const YESNO = [
    "鍾意甜定咸？",
    "會唔會煮飯？",
    "怕唔怕高？",
    "有冇養過寵物？",
    "而家用緊Apple？",
    "鍾唔鍾意行山？",
  ];

  const TURNS = {
    1: "兩隊齊口",
    2: "兩隊同時揀人",
    5: "搶答",
  };

  let state = defaultState();
  let audioCtx = null;
  let lastBeepKey = "";
  let toastTimer = 0;
  let confettiBits = [];
  let confettiRaf = 0;
  let selectedNameId = null;
  let dragNameId = null;

  function defaultState() {
    return {
      screen: "home",
      names: [],
      nameDraft: "",
      pasteDraft: "",
      hostId: null,
      red: [],
      blue: [],
      redName: "紅隊",
      blueName: "藍隊",
      namingTeam: "red",
      nameUntil: 0,
      nameHold: 0,
      tone: "family",
      scores: { red: 0, blue: 0 },
      paused: false,
      showRules: false,
      globalUntil: 0,
      globalHold: 0,
      round: 1,
      roundUntil: 0,
      roundHold: 0,
      itemUntil: 0,
      itemHold: 0,
      turn: "兩隊齊口",
      r1: { cards: [], i: 0 },
      r2: { qs: [], i: 0, redPick: null, bluePick: null, phase: "pick" },
      r3: { subjectId: null, asker: "blue", asked: [], custom: "", sentence: "", phase: "ask", used: [] },
      r4: { items: [], i: 0, actorId: null, revealed: false, phase: "actor", steal: false },
      r5: { prompts: [], i: 0, locked: null, steal: false },
      r6: { redTarget: null, blueTarget: null, current: "red", redA: "", redB: "", blueA: "", blueB: "", phase: "write", scored: { red: false, blue: false } },
      named: {},
      bestActorId: null,
      bestTeamName: null,
      packSeed: Date.now(),
    };
  }

  function uid() {
    return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickN(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  function player(id) {
    return state.names.find((p) => p.id === id);
  }

  function teamOf(id) {
    if (state.red.includes(id)) return "red";
    if (state.blue.includes(id)) return "blue";
    return null;
  }

  function teamPlayers(team) {
    const ids = team === "red" ? state.red : state.blue;
    return ids.map(player).filter(Boolean);
  }

  function otherTeam(team) {
    return team === "red" ? "blue" : "red";
  }

  function teamLabel(team) {
    return team === "red" ? (state.redName || "紅隊") : (state.blueName || "藍隊");
  }

  function now() {
    return Date.now();
  }

  function leftMs(until, hold) {
    if (state.paused) return Math.max(0, hold);
    if (!until) return 0;
    return Math.max(0, until - now());
  }

  function globalMs() { return leftMs(state.globalUntil, state.globalHold); }
  function roundMs() { return leftMs(state.roundUntil, state.roundHold); }
  function itemMs() { return leftMs(state.itemUntil, state.itemHold); }
  function nameMs() { return leftMs(state.nameUntil, state.nameHold); }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.screen) return false;
      state = Object.assign(defaultState(), data);
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur, type, vol) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime((vol ?? 0.07), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function beep() {
    ensureAudio();
    tone(880, 0.12, "sine", 0.06);
  }

  function jingle() {
    ensureAudio();
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => tone(f, 0.18, "triangle", 0.07), i * 90);
    });
  }

  function showToast(msg) {
    const el = document.getElementById("toast");
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1400);
  }

  function addScore(team, n) {
    if (!n) return;
    state.scores[team] += n;
    const label = team === "red" ? teamLabel("red") : teamLabel("blue");
    showToast(label + (n > 0 ? " +" : " ") + n);
    if (n > 0) jingle();
  }

  function markNamed(id) {
    if (!id) return;
    state.named[id] = (state.named[id] || 0) + 1;
  }

  function mostNamed() {
    let best = [];
    let max = 0;
    for (const [id, n] of Object.entries(state.named)) {
      if (n > max) { max = n; best = [id]; }
      else if (n === max && n > 0) best.push(id);
    }
    return { ids: best, count: max };
  }

  function setItemTimer(ms) {
    if (!ms) {
      state.itemUntil = 0;
      state.itemHold = 0;
      return;
    }
    if (state.paused) {
      state.itemHold = ms;
      state.itemUntil = 0;
    } else {
      state.itemUntil = now() + ms;
      state.itemHold = ms;
    }
    lastBeepKey = "";
  }

  function setRoundTimer(ms) {
    if (state.paused) {
      state.roundHold = ms;
      state.roundUntil = 0;
    } else {
      state.roundUntil = now() + ms;
      state.roundHold = ms;
    }
  }

  function pauseMatch() {
    if (state.paused) return;
    state.globalHold = globalMs();
    state.roundHold = roundMs();
    state.itemHold = itemMs();
    state.nameHold = nameMs();
    state.paused = true;
    save();
    render();
  }

  function resumeMatch() {
    if (!state.paused) return;
    const t = now();
    state.globalUntil = t + state.globalHold;
    state.roundUntil = t + state.roundHold;
    if (state.itemHold) state.itemUntil = t + state.itemHold;
    if (state.nameHold) state.nameUntil = t + state.nameHold;
    state.paused = false;
    save();
    render();
  }

  function add15() {
    const extra = 15000;
    if (state.paused) {
      state.itemHold += extra;
      state.roundHold += extra;
    } else {
      if (state.itemUntil) state.itemUntil += extra;
      if (state.roundUntil) state.roundUntil += extra;
    }
    save();
    updateHud();
    showToast("+15 秒");
  }

  function startGlobal() {
    state.paused = false;
    state.globalUntil = now() + GLOBAL_MS;
    state.globalHold = GLOBAL_MS;
    state.scores = { red: 0, blue: 0 };
    state.named = {};
    state.bestActorId = null;
    state.bestTeamName = null;
  }

  function buildPack() {
    const pack = PACKS[state.tone] || PACKS.family;
    state.r1.cards = pickN(pack.thisOrThat, 5);
    state.r1.i = 0;
    state.r2.qs = pickN(pack.likely, 3);
    state.r2.i = 0;
    state.r2.redPick = null;
    state.r2.bluePick = null;
    state.r2.phase = "pick";
    const words = pickN(CHARADES, 4);
    state.r4.items = [
      { team: "red", word: words[0] },
      { team: "blue", word: words[1] },
      { team: "red", word: words[2] },
      { team: "blue", word: words[3] },
    ];
    state.r4.i = 0;
    state.r4.actorId = null;
    state.r4.revealed = false;
    state.r4.phase = "actor";
    state.r4.steal = false;
    state.r5.prompts = BUZZER_PROMPTS.slice();
    state.r5.i = 0;
    state.r5.locked = null;
    state.r5.steal = false;
    const reds = state.red.slice();
    const blues = state.blue.slice();
    state.r6.redTarget = pickN(blues, 1)[0] || null;
    state.r6.blueTarget = pickN(reds, 1)[0] || null;
    state.r6.current = "red";
    state.r6.redA = "";
    state.r6.redB = "";
    state.r6.blueA = "";
    state.r6.blueB = "";
    state.r6.phase = "write";
    state.r6.scored = { red: false, blue: false };
    state.r3 = { subjectId: null, asker: "blue", asked: [], custom: "", sentence: "", phase: "ask", used: [] };
  }

  function startRound(n) {
    if (n > 6 || globalMs() <= 0) {
      endMatch();
      return;
    }
    state.round = n;
    state.screen = "play";
    setRoundTimer(ROUNDS[n - 1].ms);
    if (n === 1) {
      state.turn = "兩隊齊口";
      setItemTimer(ROUNDS[0].itemMs);
    } else if (n === 2) {
      state.turn = "兩隊同時揀人";
      state.r2.phase = "pick";
      state.r2.redPick = null;
      state.r2.bluePick = null;
      setItemTimer(ROUNDS[1].itemMs);
    } else if (n === 3) {
      beginR3();
      return;
    } else if (n === 4) {
      state.r4.phase = "actor";
      state.r4.revealed = false;
      state.r4.steal = false;
      state.turn = teamLabel(state.r4.items[state.r4.i].team) + "做手勢";
      setItemTimer(0);
    } else if (n === 5) {
      state.turn = "搶答";
      state.r5.locked = null;
      state.r5.steal = false;
      setItemTimer(0);
    } else if (n === 6) {
      state.r6.current = "red";
      state.r6.phase = "write";
      state.turn = teamLabel("red") + "寫介紹";
      setItemTimer(ROUNDS[5].itemMs);
    }
    save();
    render();
  }

  function skipItem() {
    if (state.screen !== "play") return;
    if (state.round === 1) r1Next();
    else if (state.round === 2) r2Next();
    else if (state.round === 3) {
      if (state.r3.subjectId && !state.r3.used.includes(state.r3.subjectId)) {
        state.r3.used.push(state.r3.subjectId);
      }
      r3NextPerson();
    }
    else if (state.round === 4) r4Next();
    else if (state.round === 5) r5Next();
    else if (state.round === 6) r6Advance();
  }

  function beginR3() {
    const pool = state.names
      .map((p) => p.id)
      .filter((id) => id !== state.hostId && !state.r3.used.includes(id));
    if (!pool.length) {
      startRound(4);
      return;
    }
    const id = pickN(pool, 1)[0];
    const team = teamOf(id);
    state.r3.subjectId = id;
    state.r3.asker = otherTeam(team);
    state.r3.asked = [];
    state.r3.custom = "";
    state.r3.sentence = "";
    state.r3.phase = "ask";
    state.turn = teamLabel(state.r3.asker) + "發問";
    setItemTimer(ROUNDS[2].itemMs);
    save();
    render();
  }

  function r1Next() {
    if (state.r1.i >= 4) {
      startRound(2);
      return;
    }
    state.r1.i += 1;
    setItemTimer(ROUNDS[0].itemMs);
    save();
    render();
  }

  function r1Score(who) {
    if (who === "red") addScore("red", 1);
    else if (who === "blue") addScore("blue", 1);
    else {
      addScore("red", 1);
      addScore("blue", 1);
      showToast("平手 各 +1");
    }
    r1Next();
  }

  function r2MaybeResolve() {
    if (!state.r2.redPick || !state.r2.bluePick) return;
    if (state.r2.redPick === state.r2.bluePick) {
      addScore("red", 1);
      addScore("blue", 1);
      markNamed(state.r2.redPick);
      const p = player(state.r2.redPick);
      showToast((p ? p.name : "") + " 被點名 · 兩隊各 +1");
      r2Next();
    } else {
      state.r2.phase = "cheer";
      state.turn = "全場歡呼";
      save();
      render();
    }
  }

  function r2Accept(team) {
    addScore(team, 2);
    markNamed(team === "red" ? state.r2.redPick : state.r2.bluePick);
    r2Next();
  }

  function r2Next() {
    if (state.r2.i >= 2) {
      startRound(3);
      return;
    }
    state.r2.i += 1;
    state.r2.redPick = null;
    state.r2.bluePick = null;
    state.r2.phase = "pick";
    state.turn = "兩隊同時揀人";
    setItemTimer(ROUNDS[1].itemMs);
    save();
    render();
  }

  function r2Timeout() {
    if (state.r2.phase === "cheer") return;
    if (state.r2.redPick && state.r2.bluePick) r2MaybeResolve();
    else r2Next();
  }

  function r3Timeout() {
    if (state.r3.phase === "ask") {
      state.r3.phase = "write";
      setItemTimer(45000);
      save();
      render();
    } else if (state.r3.phase === "write") {
      state.r3.phase = "score";
      setItemTimer(0);
      save();
      render();
    }
  }

  function r3Score(n) {
    addScore(state.r3.asker, n);
    state.r3.used.push(state.r3.subjectId);
    r3NextPerson();
  }

  function r3NextPerson() {
    const leftover = state.names.filter((p) => p.id !== state.hostId && !state.r3.used.includes(p.id));
    if (roundMs() < 15000 || leftover.length === 0) {
      startRound(4);
      return;
    }
    beginR3();
  }

  function r4StartAct() {
    state.r4.phase = "act";
    state.r4.steal = false;
    setItemTimer(ROUNDS[3].itemMs);
    save();
    render();
  }

  function r4Hit() {
    const item = state.r4.items[state.r4.i];
    addScore(item.team, 2);
    r4Next();
  }

  function r4Timeout() {
    state.r4.phase = "steal";
    state.r4.steal = true;
    state.turn = teamLabel(otherTeam(state.r4.items[state.r4.i].team)) + "搶估";
    setItemTimer(0);
    save();
    render();
  }

  function r4Steal(ok) {
    const item = state.r4.items[state.r4.i];
    if (ok) addScore(otherTeam(item.team), 1);
    r4Next();
  }

  function r4Next() {
    if (state.r4.i >= 3) {
      startRound(5);
      return;
    }
    state.r4.i += 1;
    state.r4.actorId = null;
    state.r4.revealed = false;
    state.r4.phase = "actor";
    state.r4.steal = false;
    state.turn = teamLabel(state.r4.items[state.r4.i].team) + "做手勢";
    setItemTimer(0);
    save();
    render();
  }

  function r5Buzz(team) {
    if (state.r5.locked || state.paused) return;
    state.r5.locked = team;
    state.turn = teamLabel(team) + "搶到";
    try { navigator.vibrate && navigator.vibrate(160); } catch (_) {}
    ensureAudio();
    tone(440, 0.2, "square", 0.08);
    save();
    render();
  }

  function r5Mark(ok) {
    const team = state.r5.locked;
    if (!team) return;
    if (ok) {
      addScore(team, 2);
      r5Next();
    } else {
      state.r5.steal = true;
      state.r5.locked = otherTeam(team);
      state.turn = teamLabel(state.r5.locked) + "可以偷";
      save();
      render();
    }
  }

  function r5StealMark(ok) {
    if (ok) addScore(state.r5.locked, 1);
    r5Next();
  }

  function r5Next() {
    if (state.r5.i >= 4) {
      startRound(6);
      return;
    }
    state.r5.i += 1;
    state.r5.locked = null;
    state.r5.steal = false;
    state.turn = "搶答";
    save();
    render();
  }

  function r6Timeout() {
    state.r6.phase = "score";
    setItemTimer(0);
    save();
    render();
  }

  function r6Score(n) {
    addScore(state.r6.current, n);
    state.r6.scored[state.r6.current] = true;
    r6Advance();
  }

  function r6Advance() {
    if (state.r6.current === "red" && !state.r6.scored.blue) {
      state.r6.current = "blue";
      state.r6.phase = "write";
      state.turn = teamLabel("blue") + "寫介紹";
      setItemTimer(ROUNDS[5].itemMs);
      save();
      render();
      return;
    }
    endMatch();
  }

  function endMatch() {
    const left = globalMs();
    state.screen = "finale";
    state.paused = true;
    state.globalHold = Math.max(0, left);
    state.globalUntil = 0;
    state.turn = "完場";
    jingle();
    save();
    render();
    burstConfetti();
  }

  function parseNames(text) {
    return String(text || "")
      .split(/[\n,，;；]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function addNames(list) {
    for (const n of list) {
      if (state.names.some((p) => p.name === n)) continue;
      state.names.push({ id: uid(), name: n });
    }
  }

  function splitTeams() {
    const ids = shuffle(state.names.map((p) => p.id));
    const mid = Math.ceil(ids.length / 2);
    state.red = ids.slice(0, mid);
    state.blue = ids.slice(mid);
    if (state.blue.length === 0 && state.red.length > 1) {
      state.blue = [state.red.pop()];
    }
  }

  function moveName(id, team) {
    state.red = state.red.filter((x) => x !== id);
    state.blue = state.blue.filter((x) => x !== id);
    if (team === "red") state.red.push(id);
    else state.blue.push(id);
  }

  function evenEnough() {
    return Math.abs(state.red.length - state.blue.length) <= 1
      && state.red.length >= 2
      && state.blue.length >= 2
      && state.names.length >= 4;
  }

  function startNaming() {
    state.screen = "teamNames";
    state.namingTeam = "red";
    state.paused = false;
    state.nameUntil = now() + 30000;
    state.nameHold = 30000;
    save();
    render();
  }

  function nextNaming() {
    if (state.namingTeam === "red") {
      if (!state.redName.trim()) state.redName = "紅隊";
      state.namingTeam = "blue";
      state.nameUntil = now() + 30000;
      state.nameHold = 30000;
      save();
      render();
    } else {
      if (!state.blueName.trim()) state.blueName = "藍隊";
      state.screen = "tone";
      save();
      render();
    }
  }

  function replay(mode) {
    const keepNames = mode !== "fresh";
    const names = keepNames ? state.names : [];
    const red = keepNames ? state.red : [];
    const blue = keepNames ? state.blue : [];
    const redName = keepNames ? state.redName : "紅隊";
    const blueName = keepNames ? state.blueName : "藍隊";
    const tone = state.tone;
    const hostId = keepNames ? state.hostId : null;
    state = defaultState();
    if (keepNames) {
      state.names = names;
      state.red = red;
      state.blue = blue;
      state.redName = redName;
      state.blueName = blueName;
      state.tone = tone;
      state.hostId = hostId;
      buildPack();
      startGlobal();
      startRound(1);
    } else {
      save();
      render();
    }
  }

  function fillDemo() {
    const demo = ["阿明", "小嵐", "Jason", "凱晴", "Uncle Wong", "May", "阿樂", "Suki"];
    state.names = demo.map((name) => ({ id: uid(), name }));
    splitTeams();
    save();
    render();
  }

  function currentTurn() {
    if (state.screen === "finale") return "完場";
    if (state.screen !== "play") return "準備中";
    return state.turn;
  }

  function render() {
    const app = document.getElementById("app");
    const playLike = state.screen === "play" || state.screen === "finale";
    const showHud = playLike || state.screen === "teamNames";
    app.innerHTML = `
      ${showHud ? renderHud() : ""}
      <div class="stage" id="stage">${renderStage()}</div>
      ${state.screen === "play" || state.screen === "finale" ? renderHostBar() : ""}
    `;
    bindInputs();
  }

  function renderHud() {
    const g = state.screen === "teamNames" ? nameMs() : globalMs();
    const gWarn = g <= 10000;
    const r = ROUNDS[(state.round || 1) - 1];
    const roundName = state.screen === "teamNames"
      ? "改隊名"
      : state.screen === "rules"
        ? "比賽規則"
        : state.screen === "finale"
          ? "終極結果"
          : ("第" + state.round + "回合 · " + r.name);
    const turn = state.screen === "teamNames"
      ? (state.namingTeam === "red" ? "紅隊改名" : "藍隊改名")
      : currentTurn();
    return `
      <header class="hud">
        <div class="hud-box hud-timer ${gWarn ? "warn" : ""}">
          <div class="hud-label">${state.screen === "teamNames" ? "改名倒數" : "全場 20 分鐘"}</div>
          <div class="hud-value" id="hud-global">${fmt(g)}</div>
        </div>
        <div class="hud-box hud-round">
          <div class="hud-label">而家進行</div>
          <div class="hud-value">${esc(roundName)}</div>
        </div>
        <div class="hud-box hud-red">
          <div class="hud-label">${esc(state.redName || "紅隊")}</div>
          <div class="hud-value" id="hud-red">${state.scores.red}</div>
        </div>
        <div class="hud-box hud-blue">
          <div class="hud-label">${esc(state.blueName || "藍隊")}</div>
          <div class="hud-value" id="hud-blue">${state.scores.blue}</div>
        </div>
        <div class="hud-box hud-turn">
          <div class="hud-label">而家輪到</div>
          <div class="hud-value" id="hud-turn">${esc(turn)}</div>
        </div>
      </header>
    `;
  }

  function renderHostBar() {
    const finale = state.screen === "finale";
    return `
      <nav class="hostbar">
        ${finale ? "" : `
          <button class="btn ${state.paused ? "btn-gold" : ""}" data-act="pause">${state.paused ? "繼續" : "暫停"}</button>
          <button class="btn" data-act="plus15">+15秒</button>
          <button class="btn" data-act="skip">跳過呢題</button>
        `}
        <button class="btn btn-red" data-act="adj" data-team="red" data-n="1">紅+1</button>
        <button class="btn btn-blue" data-act="adj" data-team="blue" data-n="1">藍+1</button>
        <button class="btn btn-danger" data-act="adj" data-team="red" data-n="-1">紅-1</button>
        <button class="btn btn-danger" data-act="adj" data-team="blue" data-n="-1">藍-1</button>
        <button class="btn btn-ghost" data-act="rules">顯示規則</button>
        <button class="btn btn-ghost" data-act="fs">全畫面</button>
      </nav>
    `;
  }

  function renderStage() {
    switch (state.screen) {
      case "home": return renderHome();
      case "names": return renderNames();
      case "teams": return renderTeams();
      case "teamNames": return renderTeamNames();
      case "tone": return renderTone();
      case "rules": return renderRules(true);
      case "play": return renderPlay();
      case "finale": return renderFinale();
      default: return renderHome();
    }
  }

  function renderHome() {
    const saved = (() => {
      try {
        const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return d && (d.screen === "play" || d.screen === "finale" || d.screen === "teamNames");
      } catch (_) { return false; }
    })();
    return `
      <div class="hero">
        <div class="logo-row"><span class="swatch red"></span><span class="swatch blue"></span></div>
        <div class="kicker">ONE DEVICE · BIG SCREEN</div>
        <h1>破冰對決</h1>
        <div class="prompt" style="color:var(--gold)">ICEBREAK DUEL</div>
        <p class="sub">20 分鐘 · 兩隊對決 · 6–16 人 · 一個主持人撳晒所有掣</p>
        <div class="row mt">
          <button class="btn btn-xl btn-gold" data-act="goto" data-to="names">開始破冰</button>
          ${saved ? `<button class="btn btn-xl" data-act="resume-save">繼續未完場次</button>` : ""}
        </div>
        <p class="small">無需登入 · 資料只留喺呢部機</p>
      </div>
    `;
  }

  function steps(n) {
    return `<div class="step-dots">${[1,2,3,4,5].map((i) => `<span class="dot ${i<=n?"on":""}"></span>`).join("")}</div>`;
  }

  function renderNames() {
    const chips = state.names.map((p) => `
      <span class="chip ${p.id === state.hostId ? "host" : ""}">
        ${esc(p.name)}
        <button class="x" data-act="del-name" data-id="${p.id}" aria-label="刪除">×</button>
      </span>
    `).join("");
    return `
      <div class="wrap stack">
        ${steps(1)}
        <div class="kicker">SETUP 1 / 5</div>
        <h2>輸入花名</h2>
        <p class="hint">一行一個，或者打完撳「加入」。最少 4 個人。</p>
        <div class="row">
          <input class="field grow" id="name-in" placeholder="例如：阿明" value="${esc(state.nameDraft)}" />
          <button class="btn btn-gold" data-act="add-name">加入</button>
        </div>
        <textarea class="field" id="paste-in" rows="4" placeholder="一次過貼名單，一行一個">${esc(state.pasteDraft)}</textarea>
        <div class="row">
          <button class="btn" data-act="add-paste">貼上加入</button>
          <button class="btn btn-ghost" data-act="demo">填入示範名單</button>
        </div>
        <div class="chips mt">${chips || '<span class="small">未有人</span>'}</div>
        <label class="small mt">主持人（可選，Round 3 唔會抽中）
          <select class="field mt" id="host-sel">
            <option value="">唔指定</option>
            ${state.names.map((p) => `<option value="${p.id}" ${state.hostId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn-xl btn-gold mt" data-act="to-teams" ${state.names.length<4?"disabled":""}>下一步：分兩隊（${state.names.length}人）</button>
      </div>
    `;
  }

  function renderTeams() {
    const col = (team) => teamPlayers(team).map((p) => `
      <button class="chip ${team} ${selectedNameId===p.id?"selected":""}" draggable="true" data-act="pick-chip" data-id="${p.id}">${esc(p.name)}</button>
    `).join("");
    return `
      <div class="wrap stack">
        ${steps(2)}
        <div class="kicker">SETUP 2 / 5</div>
        <h2>隨機分兩隊</h2>
        <p class="hint">撳「隨機分兩隊」，之後可以拖名或者先撳人名再撳另一隊。</p>
        <div class="row">
          <button class="btn btn-lg btn-gold" data-act="split">隨機分兩隊</button>
          <button class="btn btn-lg" data-act="back-names">返回改名</button>
        </div>
        <div class="team-board mt">
          <div class="team-col red" data-drop="red">
            <h3>紅隊 · ${state.red.length}人</h3>
            <div class="chips">${col("red")}</div>
          </div>
          <div class="team-col blue" data-drop="blue">
            <h3>藍隊 · ${state.blue.length}人</h3>
            <div class="chips">${col("blue")}</div>
          </div>
        </div>
        <button class="btn btn-xl btn-gold mt" data-act="to-naming" ${evenEnough()?"":"disabled"}>確認分隊，改隊名</button>
        ${evenEnough()?"":'<p class="hint">每隊最少 2 人，人數盡量平均。</p>'}
      </div>
    `;
  }

  function renderTeamNames() {
    const team = state.namingTeam;
    const left = fmt(nameMs());
    return `
      <div class="wrap stack center">
        ${steps(3)}
        <div class="kicker">SETUP 3 / 5 · ${left}</div>
        <h2>${team === "red" ? "紅隊" : "藍隊"} 有 30 秒改隊名</h2>
        <p class="hint">唔改就用預設：${team === "red" ? "紅隊" : "藍隊"}</p>
        <input class="field" id="tname" style="font-size:2rem;min-height:84px;text-align:center" value="${esc(team==="red"?state.redName:state.blueName)}" />
        <button class="btn btn-xl ${team==="red"?"btn-red":"btn-blue"} mt" data-act="next-name">OK，下一隊</button>
      </div>
    `;
  }

  function renderTone() {
    return `
      <div class="wrap stack">
        ${steps(4)}
        <div class="kicker">SETUP 4 / 5</div>
        <h2>揀今晚氣氛</h2>
        <p class="hint">兩套題目都 office-safe，唔會有色情、政治或者羞辱。</p>
        <div class="grid-2 mt">
          <button class="btn btn-xl ${state.tone==="family"?"btn-gold":""}" data-act="tone" data-tone="family">家庭和諧</button>
          <button class="btn btn-xl ${state.tone==="friends"?"btn-gold":""}" data-act="tone" data-tone="friends">朋友聚會</button>
        </div>
        <button class="btn btn-xl btn-gold mt" data-act="to-rules">睇規則，準備開始</button>
      </div>
    `;
  }

  function renderRules(withStart) {
    return `
      <div class="wrap stack">
        ${withStart ? steps(5) : ""}
        <div class="kicker">RULES</div>
        <h2>破冰對決規則</h2>
        <ul class="rules">
          <li>兩隊對決，20分鐘必完。</li>
          <li>齊口、指人、做手勢、搶答、一句介紹。</li>
          <li>唔准羞辱、唔准私人過界題目。</li>
          <li>主持人擁有最終分。</li>
        </ul>
        ${withStart ? `<button class="btn btn-xl btn-gold mt" data-act="start-match">開始 20 分鐘</button>` : `<button class="btn btn-xl mt" data-act="close-rules">返去比賽</button>`}
      </div>
    `;
  }

  function renderPlay() {
    let body = "";
    if (state.round === 1) body = renderR1();
    else if (state.round === 2) body = renderR2();
    else if (state.round === 3) body = renderR3();
    else if (state.round === 4) body = renderR4();
    else if (state.round === 5) body = renderR5();
    else body = renderR6();
    return `
      ${body}
      ${state.paused ? `<div class="pause-banner">已暫停</div>` : ""}
      ${state.showRules ? `<div class="modal"><div class="modal-card">${renderRules(false)}</div></div>` : ""}
    `;
  }

  function clockMs() {
    const item = itemMs();
    const hasItem = (state.itemUntil || state.itemHold) && item > 400;
    return hasItem ? item : roundMs();
  }

  function itemClock() {
    const ms = clockMs();
    return `<div class="big-timer ${ms<=5000?"warn":""}" id="item-clock">${fmt(ms)}</div>`;
  }

  function renderR1() {
    const card = state.r1.cards[state.r1.i] || ["?", "?"];
    return `
      <div class="center stack">
        <div class="kicker">第 ${state.r1.i + 1} / 5 題 · 20 秒</div>
        ${itemClock()}
        <div class="or-card">
          <div class="or-side">${esc(card[0])}</div>
          <div class="or-vs">定</div>
          <div class="or-side">${esc(card[1])}</div>
        </div>
        <p class="hint">兩隊齊口大叫一邊！主持人撳邊隊大聲啲／快人一步。</p>
        <div class="row mt">
          <button class="btn btn-xl btn-red" data-act="r1" data-who="red">${esc(state.redName)} 勝</button>
          <button class="btn btn-xl" data-act="r1" data-who="tie">平手</button>
          <button class="btn btn-xl btn-blue" data-act="r1" data-who="blue">${esc(state.blueName)} 勝</button>
        </div>
      </div>
    `;
  }

  function nameButtons(teamKey) {
    return state.names.map((p) => {
      const picked = state.r2[teamKey] === p.id;
      const marked = state.named[p.id] ? "marked" : "";
      return `<button class="btn name-btn ${marked} ${picked?"btn-gold":""}" data-act="r2-pick" data-team="${teamKey==="redPick"?"red":"blue"}" data-id="${p.id}">${esc(p.name)}</button>`;
    }).join("");
  }

  function renderR2() {
    const q = state.r2.qs[state.r2.i] || "";
    if (state.r2.phase === "cheer") {
      const a = player(state.r2.redPick);
      const b = player(state.r2.bluePick);
      return `
        <div class="center stack">
          <div class="kicker">全場歡呼</div>
          <div class="prompt">${esc(q)}</div>
          <p class="hint">兩隊揀咗唔同人。請全場為你覺得最啱嗰位歡呼！</p>
          <div class="grid-2 mt">
            <button class="btn btn-xl btn-red" data-act="r2-accept" data-team="red">${esc(state.redName)} 揀 ${esc(a?a.name:"")}</button>
            <button class="btn btn-xl btn-blue" data-act="r2-accept" data-team="blue">${esc(state.blueName)} 揀 ${esc(b?b.name:"")}</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="stack">
        <div class="center">
          <div class="kicker">第 ${state.r2.i + 1} / 3 題 · 每隊揀一個人</div>
          ${itemClock()}
          <div class="prompt mt">${esc(q)}</div>
        </div>
        <div class="grid-2 mt">
          <div class="team-col red">
            <h3 style="color:var(--red-h)">${esc(state.redName)} 揀</h3>
            <div class="names-grid mt">${nameButtons("redPick")}</div>
          </div>
          <div class="team-col blue">
            <h3 style="color:var(--blue-h)">${esc(state.blueName)} 揀</h3>
            <div class="names-grid mt">${nameButtons("bluePick")}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderR3() {
    const sub = player(state.r3.subjectId);
    const asker = teamLabel(state.r3.asker);
    if (state.r3.phase === "score") {
      return `
        <div class="center stack">
          <div class="kicker">${esc(asker)} 讀人功力</div>
          <div class="prompt">「我哋覺得你係… ${esc(state.r3.sentence || "（未寫）")}」</div>
          <p class="hint">主持人俾分：0 完全唔似 · 1 有啲似 · 2 好準</p>
          <div class="row mt">
            <button class="btn btn-xl" data-act="r3-score" data-n="0">0</button>
            <button class="btn btn-xl btn-gold" data-act="r3-score" data-n="1">1</button>
            <button class="btn btn-xl btn-ok" data-act="r3-score" data-n="2">2</button>
          </div>
        </div>
      `;
    }
    if (state.r3.phase === "write") {
      return `
        <div class="center stack">
          <div class="kicker">${esc(asker)} 用一句形容 ${esc(sub?sub.name:"")}</div>
          ${itemClock()}
          <p class="prompt">我哋覺得你係…</p>
          <textarea class="sentence" id="r3-sentence" placeholder="一個好鍾意食、又會準時出現嘅人">${esc(state.r3.sentence)}</textarea>
          <button class="btn btn-xl btn-gold" data-act="r3-to-score">交卷，等主持打分</button>
        </div>
      `;
    }
    return `
      <div class="stack">
        <div class="center">
          <div class="kicker">${esc(asker)} 最多問 3 條是非題</div>
          ${itemClock()}
          <div class="prompt mt">認識：${esc(sub?sub.name:"")}</div>
          <p class="hint">被抽中嗰位口頭答。問完可以提早寫一句。</p>
        </div>
        <div class="grid-2 mt">
          ${YESNO.map((q, i) => `
            <button class="btn ${state.r3.asked.includes(i)?"btn-gold":""}" data-act="r3-ask" data-i="${i}" ${state.r3.asked.length>=3 && !state.r3.asked.includes(i)?"disabled":""}>${esc(q)}</button>
          `).join("")}
        </div>
        <div class="row mt">
          <input class="field grow" id="r3-custom" placeholder="自訂一條是非題" value="${esc(state.r3.custom)}" />
        </div>
        <button class="btn btn-lg mt" data-act="r3-to-write">開始寫「我哋覺得你係…」</button>
      </div>
    `;
  }

  function renderR4() {
    const item = state.r4.items[state.r4.i];
    const team = item.team;
    if (state.r4.phase === "actor") {
      return `
        <div class="center stack">
          <div class="kicker">第 ${state.r4.i + 1} / 4 題 · ${esc(teamLabel(team))} 揀演員</div>
          <p class="hint">演員唔可以出聲，淨係可以用手勢。隊友有 45 秒估。</p>
          <div class="names-grid mt">
            ${teamPlayers(team).map((p) => `
              <button class="btn name-btn ${state.r4.actorId===p.id?"btn-gold":""}" data-act="r4-actor" data-id="${p.id}">${esc(p.name)}</button>
            `).join("")}
          </div>
          <button class="btn btn-xl btn-gold mt" data-act="r4-reveal" ${state.r4.actorId?"":"disabled"}>只俾演員睇</button>
        </div>
      `;
    }
    if (state.r4.phase === "reveal") {
      return `
        <div class="center stack">
          <p class="hint">請將屏幕轉去演員，隊友唔好睇。</p>
          <div class="word-secret">${esc(item.word)}</div>
          <button class="btn btn-xl btn-gold mt" data-act="r4-act">開始做手勢（45秒）</button>
        </div>
      `;
    }
    if (state.r4.phase === "steal") {
      return `
        <div class="center stack">
          <div class="kicker">超時！${esc(teamLabel(otherTeam(team)))} 可以搶估一次</div>
          <p class="prompt">詞語係：${esc(item.word)}</p>
          <div class="row mt">
            <button class="btn btn-xl btn-ok" data-act="r4-steal" data-ok="1">搶答成功</button>
            <button class="btn btn-xl" data-act="r4-steal" data-ok="0">搶答唔中</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="center stack">
        <div class="kicker">${esc(teamLabel(team))} 做手勢 · 唔好出聲</div>
        ${itemClock()}
        <p class="hint">演員：${esc(player(state.r4.actorId)?.name || "")}　詞語已隱藏</p>
        <div class="row mt">
          <button class="btn btn-xl btn-ok" data-act="r4-hit">答中</button>
          <button class="btn btn-xl" data-act="r4-miss">超時</button>
        </div>
      </div>
    `;
  }

  function renderR5() {
    const p = state.r5.prompts[state.r5.i];
    const locked = state.r5.locked;
    return `
      <div class="center stack">
        <div class="kicker">搶答 ${state.r5.i + 1} / 5 · 主持人讀出題目</div>
        ${itemClock()}
        <div class="prompt">${esc(p)}</div>
        <div class="buzzers">
          <button class="btn buzzer btn-red ${locked==="red"?"locked":""}" data-act="buzz" data-team="red" ${locked && locked!=="red"?"disabled":""}>${esc(state.redName)}拍</button>
          <button class="btn buzzer btn-blue ${locked==="blue"?"locked":""}" data-act="buzz" data-team="blue" ${locked && locked!=="blue"?"disabled":""}>${esc(state.blueName)}拍</button>
        </div>
        ${locked && !state.r5.steal ? `
          <div class="row mt">
            <button class="btn btn-xl btn-ok" data-act="r5-ok">正確</button>
            <button class="btn btn-xl btn-danger" data-act="r5-bad">錯誤</button>
          </div>
        ` : ""}
        ${state.r5.steal ? `
          <p class="hint">${esc(teamLabel(locked))} 可以偷答</p>
          <div class="row">
            <button class="btn btn-xl btn-ok" data-act="r5-steal-ok">偷答正確</button>
            <button class="btn btn-xl" data-act="r5-steal-bad">偷答唔中</button>
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderR6() {
    const team = state.r6.current;
    const targetId = team === "red" ? state.r6.redTarget : state.r6.blueTarget;
    const target = player(targetId);
    if (state.r6.phase === "score") {
      const sentence = teamSentence(team);
      return `
        <div class="center stack">
          <div class="kicker">主持人打分 1–3</div>
          <div class="prompt">你係一個 ${esc(sentence.adj || "____")} 嘅人，因為 ${esc(sentence.because || "____")}。</div>
          <p class="hint">介紹緊：${esc(target?target.name:"")}</p>
          <div class="row mt">
            <button class="btn btn-xl" data-act="r6-score" data-n="1">1</button>
            <button class="btn btn-xl btn-gold" data-act="r6-score" data-n="2">2</button>
            <button class="btn btn-xl btn-ok" data-act="r6-score" data-n="3">3</button>
          </div>
        </div>
      `;
    }
    const s = teamSentence(team);
    return `
      <div class="center stack">
        <div class="kicker">${esc(teamLabel(team))} 介紹對面嘅 ${esc(target?target.name:"")}</div>
        ${itemClock()}
        <p class="hint">呢個係收結：要真誠、要親切、唔好取笑。</p>
        <div class="blank-row mt">
          <span>你係一個</span>
          <input id="r6-adj" placeholder="例如：好記得人" value="${esc(s.adj)}" />
          <span>嘅人，因為</span>
          <input id="r6-because" placeholder="例如：一入嚟就記住大家花名" value="${esc(s.because)}" />
        </div>
        <button class="btn btn-xl btn-gold mt" data-act="r6-to-score">交卷打分</button>
      </div>
    `;
  }

  function teamSentence(team) {
    if (team === "red") return { adj: state.r6.redA || "", because: state.r6.redB || "" };
    return { adj: state.r6.blueA || "", because: state.r6.blueB || "" };
  }

  function renderFinale() {
    const red = state.scores.red;
    const blue = state.scores.blue;
    let winner = "平手！今晚大家都識交朋友。";
    let klass = "tie";
    if (red > blue) { winner = teamLabel("red") + " 勝出！"; klass = "red"; }
    if (blue > red) { winner = teamLabel("blue") + " 勝出！"; klass = "blue"; }
    const mn = mostNamed();
    const mnNames = mn.ids.map((id) => player(id)?.name).filter(Boolean).join("、") || "未有";
    const actor = player(state.bestActorId)?.name || "（主持撳下面揀）";
    const bestName = state.bestTeamName === "red" ? state.redName
      : state.bestTeamName === "blue" ? state.blueName
      : "（主持揀一個隊名）";
    return `
      <div class="wrap stack">
        <div class="kicker">20 分鐘完</div>
        <div class="winner ${klass}">${esc(winner)}</div>
        <div class="grid-2">
          <div class="hud-box hud-red center"><div class="hud-label">${esc(state.redName)}</div><div class="hud-value">${red}</div></div>
          <div class="hud-box hud-blue center"><div class="hud-label">${esc(state.blueName)}</div><div class="hud-value">${blue}</div></div>
        </div>
        <div class="row mt">
          <button class="btn btn-xl btn-gold" data-act="again">再來一局（保留名單）</button>
          <button class="btn btn-xl" data-act="reshuffle">換題再戰</button>
          <button class="btn btn-xl btn-danger" data-act="fresh">新一場（清空名單）</button>
        </div>
        <div class="award"><span>今晚最識做人</span><span>${esc(mnNames)}${mn.count?` · ${mn.count}次被點名`:""}</span></div>
        <div class="award"><span>最佳演員</span><span>${esc(actor)}</span></div>
        <div class="names-grid">
          ${state.names.map((p) => `<button class="btn ${state.bestActorId===p.id?"btn-gold":""}" data-act="best-actor" data-id="${p.id}">${esc(p.name)}</button>`).join("")}
        </div>
        <div class="award"><span>最佳隊名</span><span>${esc(bestName)}</span></div>
        <div class="row">
          <button class="btn btn-lg btn-red" data-act="best-name" data-team="red">${esc(state.redName)}</button>
          <button class="btn btn-lg btn-blue" data-act="best-name" data-team="blue">${esc(state.blueName)}</button>
        </div>
      </div>
    `;
  }

  function bindInputs() {
    const nameIn = document.getElementById("name-in");
    if (nameIn) {
      nameIn.addEventListener("input", (e) => { state.nameDraft = e.target.value; });
      nameIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); addCurrentName(); }
      });
    }
    const paste = document.getElementById("paste-in");
    if (paste) paste.addEventListener("input", (e) => { state.pasteDraft = e.target.value; });
    const host = document.getElementById("host-sel");
    if (host) host.addEventListener("change", (e) => { state.hostId = e.target.value || null; save(); });
    const tname = document.getElementById("tname");
    if (tname) tname.addEventListener("input", (e) => {
      if (state.namingTeam === "red") state.redName = e.target.value;
      else state.blueName = e.target.value;
    });
    const r3s = document.getElementById("r3-sentence");
    if (r3s) r3s.addEventListener("input", (e) => { state.r3.sentence = e.target.value; });
    const r3c = document.getElementById("r3-custom");
    if (r3c) r3c.addEventListener("input", (e) => { state.r3.custom = e.target.value; });
    const adj = document.getElementById("r6-adj");
    const bec = document.getElementById("r6-because");
    if (adj) adj.addEventListener("input", (e) => {
      if (state.r6.current === "red") state.r6.redA = e.target.value;
      else state.r6.blueA = e.target.value;
    });
    if (bec) bec.addEventListener("input", (e) => {
      if (state.r6.current === "red") state.r6.redB = e.target.value;
      else state.r6.blueB = e.target.value;
    });
  }

  function addCurrentName() {
    addNames(parseNames(state.nameDraft));
    state.nameDraft = "";
    save();
    render();
    const el = document.getElementById("name-in");
    if (el) el.focus();
  }

  function onAct(btn) {
    ensureAudio();
    const act = btn.dataset.act;
    if (act === "goto") { state.screen = btn.dataset.to; save(); render(); }
    else if (act === "resume-save") { load(); render(); }
    else if (act === "add-name") addCurrentName();
    else if (act === "add-paste") {
      addNames(parseNames(state.pasteDraft));
      state.pasteDraft = "";
      save(); render();
    }
    else if (act === "demo") fillDemo();
    else if (act === "del-name") {
      const id = btn.dataset.id;
      state.names = state.names.filter((p) => p.id !== id);
      state.red = state.red.filter((x) => x !== id);
      state.blue = state.blue.filter((x) => x !== id);
      if (state.hostId === id) state.hostId = null;
      save(); render();
    }
    else if (act === "to-teams") {
      if (state.names.length < 4) return;
      if (!state.red.length && !state.blue.length) splitTeams();
      state.screen = "teams";
      save(); render();
    }
    else if (act === "back-names") { state.screen = "names"; save(); render(); }
    else if (act === "split") { splitTeams(); save(); render(); }
    else if (act === "pick-chip") {
      const id = btn.dataset.id;
      if (selectedNameId === id) selectedNameId = null;
      else if (selectedNameId) {
        const team = teamOf(id);
        moveName(selectedNameId, team);
        selectedNameId = null;
      } else selectedNameId = id;
      render();
    }
    else if (act === "to-naming") { if (evenEnough()) startNaming(); }
    else if (act === "next-name") nextNaming();
    else if (act === "tone") { state.tone = btn.dataset.tone; save(); render(); }
    else if (act === "to-rules") { state.screen = "rules"; save(); render(); }
    else if (act === "start-match") {
      buildPack();
      startGlobal();
      startRound(1);
    }
    else if (act === "pause") { state.paused ? resumeMatch() : pauseMatch(); }
    else if (act === "plus15") add15();
    else if (act === "skip") skipItem();
    else if (act === "adj") {
      const n = Number(btn.dataset.n);
      state.scores[btn.dataset.team] = Math.max(0, state.scores[btn.dataset.team] + n);
      save(); updateHud(); showToast((btn.dataset.team==="red"?state.redName:state.blueName) + (n>0?" +1":" -1"));
    }
    else if (act === "rules") { state.showRules = true; render(); }
    else if (act === "close-rules") { state.showRules = false; render(); }
    else if (act === "fs") toggleFs();
    else if (act === "r1") r1Score(btn.dataset.who);
    else if (act === "r2-pick") {
      if (state.r2.phase !== "pick") return;
      if (btn.dataset.team === "red") state.r2.redPick = btn.dataset.id;
      else state.r2.bluePick = btn.dataset.id;
      save(); render();
      r2MaybeResolve();
    }
    else if (act === "r2-accept") r2Accept(btn.dataset.team);
    else if (act === "r3-ask") {
      const i = Number(btn.dataset.i);
      if (!state.r3.asked.includes(i) && state.r3.asked.length < 3) {
        state.r3.asked.push(i);
        save(); render();
      }
    }
    else if (act === "r3-to-write") { state.r3.phase = "write"; setItemTimer(45000); save(); render(); }
    else if (act === "r3-to-score") { state.r3.phase = "score"; setItemTimer(0); save(); render(); }
    else if (act === "r3-score") r3Score(Number(btn.dataset.n));
    else if (act === "r4-actor") { state.r4.actorId = btn.dataset.id; save(); render(); }
    else if (act === "r4-reveal") { if (state.r4.actorId) { state.r4.phase = "reveal"; state.r4.revealed = true; save(); render(); } }
    else if (act === "r4-act") r4StartAct();
    else if (act === "r4-hit") r4Hit();
    else if (act === "r4-miss") r4Timeout();
    else if (act === "r4-steal") r4Steal(btn.dataset.ok === "1");
    else if (act === "buzz") r5Buzz(btn.dataset.team);
    else if (act === "r5-ok") r5Mark(true);
    else if (act === "r5-bad") r5Mark(false);
    else if (act === "r5-steal-ok") r5StealMark(true);
    else if (act === "r5-steal-bad") r5StealMark(false);
    else if (act === "r6-to-score") { state.r6.phase = "score"; setItemTimer(0); save(); render(); }
    else if (act === "r6-score") r6Score(Number(btn.dataset.n));
    else if (act === "best-actor") { state.bestActorId = btn.dataset.id; save(); render(); }
    else if (act === "best-name") { state.bestTeamName = btn.dataset.team; save(); render(); }
    else if (act === "again" || act === "reshuffle") replay("keep");
    else if (act === "fresh") replay("fresh");
  }

  function toggleFs() {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  }

  function updateHud() {
    const g = document.getElementById("hud-global");
    if (g) {
      const ms = state.screen === "teamNames" ? nameMs() : globalMs();
      g.textContent = fmt(ms);
      g.parentElement.classList.toggle("warn", ms <= 10000);
    }
    const r = document.getElementById("hud-red");
    const b = document.getElementById("hud-blue");
    if (r) r.textContent = state.scores.red;
    if (b) b.textContent = state.scores.blue;
    const t = document.getElementById("hud-turn");
    if (t) t.textContent = currentTurn();
    const c = document.getElementById("item-clock");
    if (c) {
      const ms = clockMs();
      c.textContent = fmt(ms);
      c.classList.toggle("warn", ms <= 5000);
    }
  }

  function tick() {
    if (state.screen === "teamNames" && !state.paused) {
      if (nameMs() <= 0) nextNaming();
      else updateHud();
    }
    if (state.screen === "play" && !state.paused) {
      if (globalMs() <= 0) { endMatch(); return; }
      if (roundMs() <= 0) {
        if (state.round >= 6) endMatch();
        else startRound(state.round + 1);
        return;
      }
      const ims = itemMs();
      const clock = clockMs();
      const sec = Math.ceil(clock / 1000);
      if (sec <= 5 && sec > 0) {
        const key = state.round + "-" + sec + "-" + (state.r1?.i || 0) + "-" + (state.r2?.i || 0);
        if (key !== lastBeepKey) { lastBeepKey = key; beep(); }
      }
      if (state.itemUntil || state.itemHold) {
        if (ims <= 0) {
          if (state.round === 1) r1Next();
          else if (state.round === 2) r2Timeout();
          else if (state.round === 3) r3Timeout();
          else if (state.round === 4 && state.r4.phase === "act") r4Timeout();
          else if (state.round === 6 && state.r6.phase === "write") r6Timeout();
        }
      }
      updateHud();
    }
  }

  function burstConfetti() {
    const canvas = document.getElementById("confetti");
    const ctx = canvas.getContext("2d");
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;
    confettiBits = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h,
      r: 4 + Math.random() * 6,
      v: 2 + Math.random() * 4,
      c: Math.random() > 0.5 ? "#ff3b5c" : (Math.random() > 0.5 ? "#3d8bff" : "#ffd166"),
      s: Math.random() * 6,
    }));
    cancelAnimationFrame(confettiRaf);
    const step = () => {
      ctx.clearRect(0, 0, w, h);
      let live = false;
      for (const p of confettiBits) {
        p.y += p.v;
        p.x += Math.sin((p.y + p.s) / 20);
        if (p.y < h + 20) live = true;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.r, p.r * 0.6);
      }
      if (live) confettiRaf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, w, h);
    };
    step();
  }

  document.addEventListener("click", (e) => {
    const dropCol = e.target.closest("[data-drop]");
    if (dropCol && selectedNameId && !e.target.closest("[data-act=pick-chip]")) {
      moveName(selectedNameId, dropCol.dataset.drop);
      selectedNameId = null;
      save(); render();
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    onAct(btn);
  });

  document.addEventListener("dragstart", (e) => {
    const chip = e.target.closest("[data-act=pick-chip]");
    if (!chip) return;
    dragNameId = chip.dataset.id;
    e.dataTransfer.effectAllowed = "move";
  });
  document.addEventListener("dragover", (e) => {
    if (e.target.closest("[data-drop]")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    const col = e.target.closest("[data-drop]");
    if (!col || !dragNameId) return;
    e.preventDefault();
    moveName(dragNameId, col.dataset.drop);
    dragNameId = null;
    selectedNameId = null;
    save(); render();
  });

  window.addEventListener("beforeunload", save);

  load();
  if (new URLSearchParams(location.search).has("demo")) {
    if (state.screen === "home" || state.screen === "names") fillDemo();
  }
  render();
  setInterval(() => {
    tick();
    if (state.screen === "play" || state.screen === "teamNames") save();
  }, 250);
})();
