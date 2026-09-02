/* ============================================================
   万天昊 · 个人主页交互
   原生 JS，无任何依赖
   ============================================================ */
(() => {
  "use strict";

  const docEl = document.documentElement;
  docEl.classList.add("js");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  /* ============ 顶部进度条 + 导航状态 + 分页指示点 ============ */
  // 整屏滚动的区块表（分页点 & 停靠点共用）
  const FP_BLOCKS = [
    ["#hero", "首页"], ["#about", "关于"], ["#projects", "项目"],
    ["#p-wth", "01 Wide Thought Host"], ["#p-rag", "02 AI 面试宝典"], ["#p-nlink", "03 N-Link"],
    ["#stack", "技术栈"], ["#journey", "经历"], ["#contact", "联系"]
  ];
  const fpDotsBox = $("#fpDots");
  const fpBlockEls = FP_BLOCKS.map(([sel]) => $(sel)).filter(Boolean);
  if (fpDotsBox) {
    FP_BLOCKS.forEach(([sel, name]) => {
      if (!$(sel)) return;
      const b = document.createElement("button");
      b.className = "fp-dot";
      b.type = "button";
      b.title = name;
      b.setAttribute("aria-label", "跳转到：" + name);
      b.addEventListener("click", () => fpGo(sel === "#hero" ? 0 : sel, sel === "#contact" ? "end" : "top"));
      fpDotsBox.appendChild(b);
    });
  }
  const fpDotEls = fpDotsBox ? $$(".fp-dot", fpDotsBox) : [];

  const progress = $("#progress");
  const nav = $("#nav");
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    nav.classList.toggle("is-scrolled", y > 24);
    updateFpDots(y);
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ============ 移动端菜单 ============ */
  const toggle = $("#navToggle");
  toggle.addEventListener("click", () => {
    const open = docEl.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  });
  $$("#navLinks .nav-link").forEach(a =>
    a.addEventListener("click", () => {
      docEl.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );

  /* ============================================================
     整屏滚动（full-page scroll）
     思路：保留原生滚动管线（终端内滚区 / 输入框 / 选中文本不受影响），
     仅在桌面精确指针下接管 wheel：每次手势吸附到「下一个停靠点」。
     停靠点 = 各区块顶部 + 高区块内部按视口高插入的中间站 + 文档底部，
     因此 1.5 个视口高的项目区块也能逐屏读完，不会一次跳过。
     ============================================================ */
  // 当前所在页高亮（读取实况位置，天然适配尺寸变化）
  function updateFpDots(y) {
    if (!fpDotEls.length) return;
    const half = window.innerHeight * 0.5;
    let idx = 0;
    fpBlockEls.forEach((el, i) => {
      if (el.getBoundingClientRect().top <= half) idx = i;
    });
    fpDotEls.forEach((d, i) => d.classList.toggle("is-active", i === idx));
  }

  const snapEnabled = () =>
    finePointer && !reducedMotion && window.innerWidth >= 1024 && !docEl.classList.contains("nav-open");

  const maxScrollY = () => document.documentElement.scrollHeight - window.innerHeight;

  // 停靠点：每次手势实时重算，天然处理窗口 resize / 响应式高度变化
  function getStops() {
    const vh = window.innerHeight;
    const top = el => el.getBoundingClientRect().top + window.scrollY;
    const tops = fpBlockEls.map(top);
    const end = maxScrollY();
    const MIN = Math.max(140, vh * 0.18);   // 相邻停靠点最小间距，防止原地微跳
    const stops = [0];
    for (let i = 0; i < tops.length; i++) {
      const cur = Math.min(tops[i], end);
      if (cur > stops[stops.length - 1]) stops.push(cur);
      const next = i + 1 < tops.length ? Math.min(tops[i + 1], end) : end;
      // 区块比一屏高出一截时，在区块内部按整屏插入中间站
      for (let t = cur + vh; t < next - MIN; t += vh) stops.push(t);
    }
    stops.push(end);
    return [...new Set(stops)].sort((a, b) => a - b);
  }

  function animateScrollTo(target, dur = 760) {
    return new Promise(resolve => {
      const start = window.scrollY;
      const delta = target - start;
      if (Math.abs(delta) < 2) { resolve(); return; }
      const t0 = performance.now();
      const prevBehavior = docEl.style.scrollBehavior;
      docEl.style.scrollBehavior = "auto";   // 逐帧动画期间关掉 CSS smooth，避免打架
      (function frame(now) {
        const p = Math.min((now - t0) / dur, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;  // easeInOutCubic
        window.scrollTo(0, start + delta * e);
        if (p < 1) requestAnimationFrame(frame);
        else { docEl.style.scrollBehavior = prevBehavior; resolve(); }
      })(t0);
    });
  }

  // 动画结束后再等 250ms 滚轮静默期才解锁，吸收触摸板惯性，防止连跳两页
  function releaseSnapLock() {
    const check = () => {
      if (performance.now() - lastWheelAt > 250) snapping = false;
      else setTimeout(check, 120);
    };
    setTimeout(check, 260);
  }

  let snapping = false;   // 动画锁：动画期间忽略一切滚轮
  let lastWheelAt = 0;    // 最近滚轮时间戳：用于识别触摸板惯性

  function fpGo(target, mode) {
    if (!snapEnabled() || snapping) return;
    let y;
    if (target === 0) y = 0;
    else if (mode === "end") y = maxScrollY();
    else {
      const el = $(target);
      if (!el) return;
      y = el.getBoundingClientRect().top + window.scrollY;
    }
    snapping = true;
    animateScrollTo(y).then(releaseSnapLock);
  }

  window.addEventListener("wheel", e => {
    if (!snapEnabled()) return;                                   // 触屏 / 减动效 / 窄屏 → 原生滚动
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;          // 横向滚动不接管
    // 终端等内部滚动区优先自滚，滚到边缘再把手势交给整屏翻页
    const box = e.target.closest && e.target.closest(".term-body");
    if (box) {
      const canUp = box.scrollTop > 2;
      const canDown = box.scrollTop + box.clientHeight < box.scrollHeight - 2;
      if (e.deltaY < 0 && canUp) return;
      if (e.deltaY > 0 && canDown) return;
    }
    e.preventDefault();
    const now = performance.now();
    lastWheelAt = now;
    if (snapping) return;                                         // 动画锁：连滚只算一次
    const dy = e.deltaY;
    if (!dy) return;

    const stops = getStops();
    const y = window.scrollY;
    const MIN = Math.max(140, window.innerHeight * 0.18);
    let target;
    if (dy > 0) {
      target = stops.find(s => s >= y + MIN);
      if (target === undefined) return;                           // 已在最后一页
    } else {
      const above = stops.filter(s => s <= y - MIN);
      target = above[above.length - 1];
      if (target === undefined) return;                           // 已在第一页
    }
    snapping = true;
    animateScrollTo(target).then(releaseSnapLock);
  }, { passive: false });

  // 导航 / 按钮 / 分页点的锚点跳转走同一套吸附动画，避免与滚轮锁打架
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const href = a.getAttribute("href");
      if (href === "#") return;
      const el = $(href);
      if (!el) return;
      if (!snapEnabled()) return;                                 // 小屏仍用 CSS smooth 原生跳转
      e.preventDefault();
      fpGo(href, href === "#contact" ? "end" : "top");
    });
  });

  /* ============ 滚动进入动画 ============ */
  // reactbits Scrambled/Decrypted Text：文字从乱码中「解码」显现
  const SCRAMBLE_CHARS = "01<>/{}[]#$%&=+*;:ABCDEFGHKMNPRSTUVXYZ";
  function scrambleIn(el) {
    const original = el.dataset.text || (el.dataset.text = el.textContent);
    if (reducedMotion) { el.textContent = original; return; }
    const t0 = performance.now();
    const dur = 620;
    (function frame(now) {
      const p = Math.min((now - t0) / dur, 1);
      const settled = Math.floor(p * original.length);
      el.textContent = [...original].map((ch, i) => {
        if (i < settled || /\s/.test(ch)) return ch;   // 已解码 / 空白原样保留
        return SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      }).join("");
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = original;
    })(t0);
  }

  const revealIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("is-v");
        if (e.target.matches("[data-scramble]")) scrambleIn(e.target);
        e.target.querySelectorAll("[data-scramble]").forEach(scrambleIn);
        revealIO.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$("[data-reveal]").forEach(el => revealIO.observe(el));

  /* ============ 数字滚动 ============ */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const useComma = el.dataset.format === "comma";
    const fmt = v => {
      let s = useComma ? Math.round(v).toLocaleString("en-US") : v.toFixed(decimals);
      return s + suffix;
    };
    if (reducedMotion) { el.textContent = fmt(target); return; }
    const dur = 1500;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  const countIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { animateCount(e.target); countIO.unobserve(e.target); }
    }
  }, { threshold: 0.5 });
  $$("[data-count]").forEach(el => countIO.observe(el));

  /* ============ Hero 打字轮换 ============ */
  const rotor = $("#rotor");
  const rotorLines = [
    "把大模型做成能上线的应用",
    "Rust × TypeScript × Kotlin 全栈闭环",
    "RAG / Multi-Agent / MCP 落地经验",
    "从需求分析到部署上线，一个人走完"
  ];
  if (reducedMotion) {
    rotor.textContent = rotorLines[0];
  } else {
    let li = 0, ci = 0, deleting = false;
    (function tick() {
      const line = rotorLines[li];
      ci += deleting ? -1 : 1;
      rotor.textContent = line.slice(0, ci);
      let delay = deleting ? 30 : 78;
      if (!deleting && ci === line.length) { delay = 2000; deleting = true; }
      else if (deleting && ci === 0) { deleting = false; li = (li + 1) % rotorLines.length; delay = 420; }
      setTimeout(tick, delay);
    })();
  }

  /* ============ 交互终端 ============ */
  const termOut = $("#termOut");
  const termBody = $("#termBody");
  const termInput = $("#termInput");
  const termEcho = $("#termEcho");
  const term = $("#term");
  const PROMPT = "wan@qingdao:~$ ";
  const history = [];
  let hIndex = -1;

  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function print(html, cls = "t-out") {
    const div = document.createElement("div");
    div.className = "t-line " + cls;
    div.innerHTML = html;
    termOut.appendChild(div);
    termBody.scrollTop = termBody.scrollHeight;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function typeCommand(cmd) {
    const div = document.createElement("div");
    div.className = "t-line t-cmd";
    div.innerHTML = `<span class="t-prompt">${PROMPT}</span>`;
    termOut.appendChild(div);
    if (reducedMotion) { div.innerHTML += esc(cmd); termBody.scrollTop = termBody.scrollHeight; return; }
    for (let i = 1; i <= cmd.length; i++) {
      div.innerHTML = `<span class="t-prompt">${PROMPT}</span>` + esc(cmd.slice(0, i));
      termBody.scrollTop = termBody.scrollHeight;
      await sleep(26 + Math.random() * 40);
    }
  }

  const BOOT = [
    { cmd: "whoami" },
    { out: ["万天昊 — AI 应用开发工程师（LLM / Agent 方向）", "3 款应用完整闭环 · 青岛 / 远程 · 随时到岗"] },
    { cmd: "ls ./projects" },
    { out: [
      "<span class='t-hl'>wide-thought-host/</span>   Rust · 开源 AI 编码 Agent（核心贡献者）",
      "<span class='t-hl'>ai-interview/</span>        RAG · 面试准备平台（已上线）",
      "<span class='t-hl'>n-link/</span>               Kotlin · 尼康相机伴侣 App（v0.1.4）"] },
    { cmd: "./status.sh --now" },
    { out: ["<span class='t-ok'>[ok]</span> open to work — 正在看 AI 应用开发机会", "<span class='t-dim'>[tip] 输入 help，这个终端是真的能敲的</span>"] }
  ];

  let booted = false;
  async function boot() {
    if (booted) return;
    booted = true;
    for (const step of BOOT) {
      if (step.cmd) { await typeCommand(step.cmd); await sleep(160); }
      else for (const line of step.out) { print(line); await sleep(reducedMotion ? 0 : 90); }
    }
  }
  boot();

  const CMDS = {
    help() {
      print([
        "<span class='t-hl'>projects</span>   三个项目的快速索引",
        "<span class='t-hl'>stack</span>      技术栈速览",
        "<span class='t-hl'>whoami</span>     我是谁",
        "<span class='t-hl'>contact</span>    联系方式",
        "<span class='t-hl'>neofetch</span>   系统信息",
        "<span class='t-hl'>hire-me</span>    试试看",
        "<span class='t-hl'>clear</span>      清屏"
      ].join("<br>"));
    },
    whoami() {
      print("万天昊，AI 应用开发工程师。3 年工程现场数据体系经验 + 半年高强度独立开发，\n3 款应用从需求到部署完整闭环。Rust / TypeScript / Kotlin。");
    },
    projects() {
      print(
        "<span class='t-hl'>01</span> Wide Thought Host — AI 编码 Agent（Rust · Multi-Agent · MCP）\n      <a class='t-link' href='https://github.com/Wan-1230/Wide-Thought-Host' target='_blank' rel='noopener'>github.com/Wan-1230/Wide-Thought-Host</a>\n" +
        "<span class='t-hl'>02</span> AI 面试宝典 — RAG 面试平台（React · Node · ChromaDB）\n      <a class='t-link' href='https://ai-interview-6rn.pages.dev' target='_blank' rel='noopener'>ai-interview-6rn.pages.dev</a>\n" +
        "<span class='t-hl'>03</span> N-Link — 尼康相机伴侣 App（Kotlin · BLE/Wi-Fi/USB · PTP）\n      <a class='t-link' href='https://github.com/Wan-1230' target='_blank' rel='noopener'>github.com/Wan-1230</a>"
      );
    },
    stack() {
      print("Rust · TypeScript · Python · Kotlin · SQL · C\nRAG 全链路 / Multi-Agent / MCP / SSE / TTFT 调优\nReact · Node.js · ChromaDB · Docker · Cloudflare Pages · Railway");
    },
    contact() {
      print("email   <a class='t-link' href='mailto:wth123500@qq.com'>wth123500@qq.com</a>\ngithub  <a class='t-link' href='https://github.com/Wan-1230' target='_blank' rel='noopener'>github.com/Wan-1230</a>\nphone   176 1512 3354");
    },
    neofetch() {
      print(
        "<span class='t-hl'>        wth@dev</span>\n" +
        "        --------\n" +
        "<span class='t-hl'>OS</span>      青岛 · 可远程 / relocate\n" +
        "<span class='t-hl'>FOCUS</span>   LLM · Agent · RAG\n" +
        "<span class='t-hl'>APPS</span>    3 shipped（2 在线 / 1 发布）\n" +
        "<span class='t-hl'>UPTIME</span>  3 年工程现场 + 半年全力冲刺\n" +
        "<span class='t-hl'>STATUS</span>  open to work"
      );
    },
    "hire-me"() {
      print("<span class='t-ok'>✓ 已收到</span> — 邮箱在下面，24 小时内一定回。<a class='t-link' href='mailto:wth123500@qq.com'>wth123500@qq.com</a>");
    },
    clear() { termOut.innerHTML = ""; }
  };

  async function runCommand(raw) {
    const input = raw.trim();
    print(`<span class="t-prompt">${PROMPT}</span>` + esc(input), "t-cmd");
    if (!input) return;
    history.push(input);
    hIndex = history.length;
    const lower = input.toLowerCase();

    if (lower === "sudo hire-me" || lower === "sudo hire me") {
      print("<span class='t-dim'>[sudo] password for interviewer:</span> ********  <span class='t-ok'>验证通过 ✓</span>");
      await sleep(reducedMotion ? 0 : 350);
      CMDS["hire-me"]();
      return;
    }
    const key = lower.replace(/\s+/g, " ");
    const fn = CMDS[key] || (key === "hire me" ? CMDS["hire-me"] : null);
    if (fn) { fn(); return; }
    print(`zsh: command not found: ${esc(input.split(" ")[0])} —— 试试 <span class='t-hl'>help</span>`, "t-err");
  }

  term.addEventListener("click", () => termInput.focus({ preventScroll: true }));
  termInput.addEventListener("input", () => { termEcho.textContent = termInput.value; });
  termInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const v = termInput.value;
      termInput.value = "";
      termEcho.textContent = "";
      runCommand(v);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hIndex > 0) { hIndex--; termInput.value = history[hIndex] || ""; termEcho.textContent = termInput.value; }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIndex < history.length) { hIndex++; termInput.value = history[hIndex] || ""; termEcho.textContent = termInput.value; }
    }
  });

  /* ============ Hero 点阵背景 ============ */
  const canvas = $("#dotGrid");
  const ctx = canvas.getContext("2d");
  const hero = $("#hero");
  let dots = [], pulses = [], heroVisible = true, mx = -9999, my = -9999;
  const GAP = 26, R = 150;
  let W = 0, H = 0, dpr = 1;

  function buildDots() {
    dots = [];
    for (let x = GAP / 2; x < W; x += GAP)
      for (let y = GAP / 2; y < H; y += GAP)
        dots.push({ x, y });
  }
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.offsetWidth; H = hero.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDots();
    if (reducedMotion) drawDots(0);
  }
  function drawDots(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of pulses) p.r += 1.6;
    pulses = pulses.filter(p => p.r < p.max);

    for (const d of dots) {
      const dxm = d.x - mx, dym = d.y - my;
      const dm = Math.hypot(dxm, dym);
      let alpha = 0.05 + 0.05 * Math.sin(t / 1400 + d.x / 90 + d.y / 70);
      let ox = 0, oy = 0, warm = 0;

      if (dm < R) {
        const f = 1 - dm / R;
        alpha += f * 0.5;
        warm = f;
        ox = (dxm / (dm || 1)) * f * 9;
        oy = (dym / (dm || 1)) * f * 9;
      }
      for (const pu of pulses) {
        const dd = Math.abs(Math.hypot(d.x - pu.x, d.y - pu.y) - pu.r);
        if (dd < 14) { const f = 1 - dd / 14; alpha += f * 0.5; warm = Math.max(warm, f); }
      }
      alpha = Math.min(alpha, 0.85);
      ctx.beginPath();
      ctx.arc(d.x + ox, d.y + oy, warm > 0.05 ? 1.5 : 1.1, 0, 6.2832);
      ctx.fillStyle = warm > 0.05
        ? `rgba(232,163,61,${alpha})`
        : `rgba(234,228,214,${alpha})`;
      ctx.fill();
    }
  }
  function loop(t) {
    if (heroVisible && !reducedMotion) drawDots(t);
    requestAnimationFrame(loop);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  hero.addEventListener("mousemove", e => {
    const r = hero.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
  });
  hero.addEventListener("mouseleave", () => { mx = my = -9999; });
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);

  if (!reducedMotion) {
    requestAnimationFrame(loop);
    setInterval(() => {
      if (heroVisible && document.visibilityState === "visible" && pulses.length < 3)
        pulses.push({ x: Math.random() * W, y: Math.random() * H, r: 0, max: Math.max(W, H) * 0.4 });
    }, 2600);
  }

  /* ============ 项目区块进入 → 触发 SVG 动效 ============ */
  const projIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in-view"); projIO.unobserve(e.target); }
    }
  }, { threshold: 0.25 });
  $$(".project").forEach(el => projIO.observe(el));

  /* ============ RAG 流式对话演示 ============ */
  const chatText = $("#chatText");
  const chatCaret = $("#chatCaret");
  const chatStatus = $("#chatStatus");
  const chatMsgs = [
    "基于题库召回结果：建议把项目经历改成「动作 + 量化结果」结构——主导 RAG 全链路调优，分块策略 / top-k / 相似度阈值三处迭代，首字响应（TTFT）压进亚秒级，255 道高频题精准命中。",
    "这份经历能过筛：有上线链接、有量化指标。建议补一个对比基线，例如召回 Top-3 命中率从 x% 提升到 y%——面试官最认这种闭环。",
    "结合 JD 关键词（RAG / Agent / 部署），把「负责开发」改成「独立交付」：文档解析 → 分块 → Embedding → 检索 → SSE 流式生成全链路，一人完成并部署上线。"
  ];
  let chatStarted = false;

  async function chatLoop() {
    if (chatStarted) return;
    chatStarted = true;
    if (reducedMotion) { chatText.textContent = chatMsgs[0]; return; }
    let i = 0;
    for (;;) {
      const msg = chatMsgs[i % chatMsgs.length];
      chatText.textContent = "";
      for (const ch of msg) {
        chatText.textContent += ch;
        await sleep(24 + Math.random() * 46);
      }
      await sleep(3400);
      i++;
    }
  }
  const chatIO = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { chatLoop(); chatIO.disconnect(); }
  }, { threshold: 0.3 });
  if (chatText) chatIO.observe(chatText);

  const ttfts = ["0.38s", "0.42s", "0.45s", "0.36s", "0.41s"];
  const chunks = [384, 512, 640];
  const topks = [4, 5, 6];
  if (!reducedMotion) setInterval(() => {
    if (!chatStarted || document.hidden) return;
    const pick = a => a[Math.floor(Math.random() * a.length)];
    chatStatus.textContent = `sse: streaming · chunk ${pick(chunks)} · top-k ${pick(topks)} · ttft ${pick(ttfts)}`;
  }, 2400);

  /* ============ N-Link 手机日志 ============ */
  const phoneLog = $("#phoneLog");
  const LOGS = [
    { c: "ble", t: "扫描 → 发现 D750" },
    { c: "ble", t: "GATT 通道建立 ✓" },
    { c: "wifi", t: "STA 握手完成 · 35 MB/s" },
    { c: "ptp", t: "半按对焦 OK" },
    { c: "ptp", t: "全按快门 · 间隔拍摄 OK" },
    { c: "file", t: "拍完即传 IMG_2041.NEF" },
    { c: "link", t: "断线重连演练 ✓" },
    { c: "watch", t: "连接保持 24h+ ✓" }
  ];
  let logStarted = false;
  async function logLoop() {
    if (logStarted) return;
    logStarted = true;
    if (reducedMotion) {
      phoneLog.innerHTML = LOGS.map(l => `<span class="pl-line c-${l.c} on"><span class="pl-tag">[${l.c}]</span>  ${l.t}</span>`).join("");
      return;
    }
    for (;;) {
      phoneLog.innerHTML = "";
      for (const l of LOGS) {
        const span = document.createElement("span");
        span.className = `pl-line c-${l.c}`;
        span.innerHTML = `<span class="pl-tag">[${l.c}]</span>  ${l.t}`;
        phoneLog.appendChild(span);
        requestAnimationFrame(() => span.classList.add("on"));
        await sleep(760);
      }
      await sleep(2800);
    }
  }
  const logIO = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { logLoop(); logIO.disconnect(); }
  }, { threshold: 0.3 });
  if (phoneLog) logIO.observe(phoneLog);

  /* ============ 导航高亮当前区块 ============ */
  const navLinks = $$(".nav-link");
  const secIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      navLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  ["about", "projects", "stack", "journey", "contact"].forEach(id => {
    const el = document.getElementById(id);
    if (el) secIO.observe(el);
  });

  /* ============ 自定义光标 ============ */
  if (finePointer && !reducedMotion) {
    docEl.classList.add("has-cursor");
    const dotEl = $("#cursorDot");
    const ringEl = $("#cursorRing");
    let x = -100, y = -100, rx = -100, ry = -100, shown = false;

    document.addEventListener("mousemove", e => {
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; rx = x; ry = y; dotEl.style.opacity = 1; ringEl.style.opacity = 1; }
    });
    document.addEventListener("mouseleave", () => { dotEl.style.opacity = 0; ringEl.style.opacity = 0; shown = false; });
    document.addEventListener("mouseenter", () => { dotEl.style.opacity = 1; ringEl.style.opacity = 1; shown = true; });

    (function follow() {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dotEl.style.transform = `translate(${x}px, ${y}px)`;
      ringEl.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(follow);
    })();

    const hot = "a, button, .tag, .term, input, [data-copy]";
    document.addEventListener("mouseover", e => {
      if (e.target.closest(hot)) ringEl.classList.add("is-active");
    });
    document.addEventListener("mouseout", e => {
      if (e.target.closest(hot)) ringEl.classList.remove("is-active");
    });
  }

  /* ============ 磁吸按钮 ============ */
  if (finePointer && !reducedMotion) {
    $$(".mag").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.22;
        const dy = (e.clientY - r.top - r.height / 2) * 0.22;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ============ 项目卡片聚光灯 ============ */
  if (finePointer && !reducedMotion) {
    $$(".visual-card").forEach(card => {
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ============ 区块背景特效（reactbits 风格移植） ============ */
  // 进入视口才跑、离开即停，三个画布互不抢占
  function fxWhenVisible(canvas, start, stop) {
    if (!canvas) return;
    let running = false, cleanup = null;
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; cleanup = start(); }
      else if (!entry.isIntersecting && running) { running = false; if (cleanup) cleanup(); }
    }, { threshold: 0.05 }).observe(canvas);
    void stop;
  }

  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // Grid Motion：技术栈区块背景，随机网格单元呼吸闪烁
  (function gridMotion() {
    const canvas = $("#stackFx");
    if (!canvas || reducedMotion) return;
    const GAP = 34;
    let ctx, w, h, raf, cells = [], timer;
    function build() {
      ({ ctx, w, h } = fitCanvas(canvas));
      cells = [];
      for (let x = GAP / 2; x < w; x += GAP)
        for (let y = GAP / 2; y < h; y += GAP)
          cells.push({ x, y, a: 0 });
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        if (c.a <= 0) continue;
        ctx.fillStyle = `rgba(232,163,61,${c.a})`;
        ctx.fillRect(c.x - GAP / 2 + 2, c.y - GAP / 2 + 2, GAP - 4, GAP - 4);
        c.a -= 0.008;
      }
      raf = requestAnimationFrame(draw);
    }
    build();
    return fxWhenVisible(canvas, () => {
      raf = requestAnimationFrame(draw);
      timer = setInterval(() => {
        for (let k = 0; k < 2; k++) cells[(Math.random() * cells.length) | 0].a = 0.05 + Math.random() * 0.05;
      }, 420);
      window.addEventListener("resize", build);
      return () => { cancelAnimationFrame(raf); clearInterval(timer); window.removeEventListener("resize", build); };
    });
  })();

  // Letter Glitch：页脚背景，随机字符矩阵明灭
  (function letterGlitch() {
    const canvas = $("#footerFx");
    if (!canvas || reducedMotion) return;
    const CHARS = "01<>/{}[]#$%&=+*;:AZKWTH";
    const GAP = 30;
    let ctx, w, h, raf, cells = [], timer;
    function build() {
      ({ ctx, w, h } = fitCanvas(canvas));
      cells = [];
      for (let x = GAP / 2; x < w; x += GAP)
        for (let y = GAP / 2; y < h; y += GAP)
          cells.push({ x, y, ch: "", a: 0, green: false });
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.font = "12px " + "ui-monospace, Consolas, monospace";
      for (const c of cells) {
        if (c.a <= 0) continue;
        ctx.fillStyle = c.green ? `rgba(134,185,126,${c.a})` : `rgba(232,163,61,${c.a})`;
        ctx.fillText(c.ch, c.x - 4, c.y + 4);
        c.a -= 0.012;
      }
      raf = requestAnimationFrame(draw);
    }
    build();
    return fxWhenVisible(canvas, () => {
      raf = requestAnimationFrame(draw);
      timer = setInterval(() => {
        for (let k = 0; k < 4; k++) {
          const c = cells[(Math.random() * cells.length) | 0];
          c.ch = CHARS[(Math.random() * CHARS.length) | 0];
          c.a = 0.12 + Math.random() * 0.14;
          c.green = Math.random() < 0.22;
        }
      }, 300);
      window.addEventListener("resize", build);
      return () => { cancelAnimationFrame(raf); clearInterval(timer); window.removeEventListener("resize", build); };
    });
  })();

  /* ============ reactbits Click Spark：点击迸发火花 ============ */
  if (finePointer && !reducedMotion) {
    document.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      if (e.target.closest("input, textarea, .term-body")) return;   // 输入场景不打扰
      const box = document.createElement("div");
      box.className = "click-spark";
      box.style.left = e.clientX + "px";
      box.style.top = e.clientY + "px";
      for (let i = 0; i < 8; i++) {
        const s = document.createElement("i");
        s.style.setProperty("--a", i * 45 + "deg");
        box.appendChild(s);
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 600);
    });
  }

  /* ============ 移动端菜单：Esc 关闭 + 锁滚动 ============ */  const menuState = () => docEl.classList.contains("nav-open");
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && menuState()) {
      docEl.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  new MutationObserver(() => {
    document.body.style.overflow = menuState() ? "hidden" : "";
  }).observe(docEl, { attributes: true, attributeFilter: ["class"] });

  /* ============ 复制 + Toast ============ */
  const toast = $("#toast");
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  $$("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      showToast("已复制：" + text);
    });
  });

  /* ============ 控制台彩蛋 ============ */
  try {
    console.log(
      "%cwan@qingdao:~$ cat .env\n%cHIRE_MODE=true\nCONTACT=wth123500@qq.com",
      "color:#86b97e;font-family:monospace",
      "color:#e8a33d;font-family:monospace;font-weight:bold"
    );
  } catch {}

})();
