(function(){
  const qs=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
  const screens={home:qs('#home'),talk:qs('#talk'),urge:qs('#urge'),progress:qs('#progress')};
  const langBtn=qs('#langBtn'),talkBtn=qs('#talkBtn'),urgeBtn=qs('#urgeBtn'),progressBtn=qs('#progressBtn');
  const backFromTalk=qs('#backFromTalk'),backFromUrge=qs('#backFromUrge'),backFromProg=qs('#backFromProg');
  const chat=qs('#chat'),ptt=qs('#ptt'),speakToggle=qs('#speakToggle');
  const daysEl=qs('#days'),crave=qs('#crave'),saveDay=qs('#saveDay');

  // Consent gate
  const gate=qs('#gate'), gateGo=qs('#gateGo'), age16=qs('#age16'), gateLang=qs('#gateLang');
  let lang = localStorage.getItem('lang') || 'FR';
  let ttsOn = true;
  let days = Number(localStorage.getItem('days')||'0');
  let consent = localStorage.getItem('consent_ok')==='1';

  // i18n
  function tr(fr,en){ return (lang==='FR')?fr:en; }
  function applyLang(){
    $$('[data-fr]').forEach(el => el.textContent = tr(el.getAttribute('data-fr'), el.getAttribute('data-en')) );
    langBtn.textContent = (lang==='FR')?'EN':'FR';
    gateLang.textContent = (lang==='FR')?'EN':'FR';
  }
  langBtn.onclick=()=>{ lang=(lang==='FR')?'EN':'FR'; localStorage.setItem('lang',lang); applyLang(); };
  gateLang.onclick=()=>{ lang=(lang==='FR')?'EN':'FR'; localStorage.setItem('lang',lang); applyLang(); };

  // Consent overlay behavior
  function maybeShowGate(){
    if(!consent){
      gate.classList.remove('hidden');
    } else {
      gate.classList.add('hidden');
    }
  }
  age16.addEventListener('change', ()=> gateGo.disabled = !age16.checked );
  gateGo.addEventListener('click', ()=>{
    if(!age16.checked) return;
    consent = true; localStorage.setItem('consent_ok','1'); gate.classList.add('hidden');
  });

  // Navigation
  function show(screen){ Object.values(screens).forEach(s=>s.classList.remove('active')); screens[screen].classList.add('active'); }
  talkBtn.onclick=()=>{ show('talk'); greet(); };
  urgeBtn.onclick=()=> show('urge');
  progressBtn.onclick=()=>{ daysEl.textContent = String(days); show('progress'); };
  backFromTalk.onclick=()=> show('home');
  backFromUrge.onclick=()=> show('home');
  backFromProg.onclick=()=> show('home');
  saveDay.onclick=()=>{ days += 1; localStorage.setItem('days', String(days)); daysEl.textContent = String(days); toast(tr('Victoire enregistrée ✅', 'Victory saved ✅')); };

  // Chat helpers
  function msg(text, who='ai'){
    const el = document.createElement('div'); el.className = 'msg ' + (who==='ai'?'ai':'you');
    el.textContent = text; chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
    if (who==='ai' && ttsOn) speak(text);
  }
  function greet(){
    chat.innerHTML='';
    msg( tr("Bonjour 👋 Je suis ton coach. Parle-moi de ton envie.", "Hello 👋 I'm your coach. Tell me about your craving.") );
  }

  // TTS
  function speak(text){
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.0; u.lang = (lang==='FR')?'fr-CA':'en-CA';
    speechSynthesis.speak(u);
  }
  speakToggle.addEventListener('click', ()=> { ttsOn = !ttsOn; speakToggle.setAttribute('aria-pressed', String(ttsOn)); speakToggle.style.background = ttsOn ? '#10b981' : '#9ca3af'; });

  // ASR (Push-to-talk)
  let rec, listening = false;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    rec = new SR(); rec.continuous = false; rec.interimResults = false;
    function startASR(){
      try{
        if (window.speechSynthesis) speechSynthesis.cancel(); // avoid echo
        rec.lang = (lang==='FR')?'fr-CA':'en-CA';
        rec.start(); listening = true; ptt.classList.add('listening');
        ptt.innerHTML = '🎤 ' + tr('Écoute… (relâche)', 'Listening… (release)');
      }catch(e){}
    }
    function stopASR(){
      try{ rec.stop(); }catch(e){}
      listening=false; ptt.classList.remove('listening');
      ptt.innerHTML = '🎤 <span>'+tr('Appuie pour parler','Press to talk')+'</span>';
    }
    ptt.addEventListener('mousedown', startASR);
    ptt.addEventListener('touchstart', (e)=>{ e.preventDefault(); startASR(); }, {passive:false});
    const end=()=> stopASR();
    ptt.addEventListener('mouseup', end);
    ptt.addEventListener('mouseleave', ()=>{ if(listening) stopASR(); });
    ptt.addEventListener('touchend', end);

    rec.onresult = (ev)=>{
      const text = ev.results[0][0].transcript;
      msg(text, 'you'); coach(text);
    };
    rec.onend = ()=>{ if(listening) stopASR(); };
    rec.onerror = ()=> stopASR();
  } else {
    // fallback
    ptt.onclick = ()=>{
      const text = prompt(tr('Dis-moi ce que tu ressens :','Tell me how you feel:'));
      if (!text) return;
      msg(text,'you'); coach(text);
    };
  }

  // Crisis keywords
  const crisis = {
    fr: ["suicide","me tuer","plus envie de vivre","mettre fin"],
    en: ["suicide","kill myself","end my life","don’t want to live","dont want to live"]
  };

  // Simple scripted coach (low-cost demo first)
  function coach(input){
    const low = input.toLowerCase();
    const danger = (lang==='FR'?crisis.fr:crisis.en).some(k => low.includes(k));
    if (danger){
      msg( tr("Je suis là avec toi. Tu comptes. Si tu es en danger, appelle le 911. Tu peux aussi parler à quelqu’un au 988 (Canada).",
               "I'm here with you. You matter. If you’re in danger, call 911. You can also talk to someone at 988 (Canada).") );
      return;
    }
    if (/(envie|craving|urge|boire|drink|smoke|gamble|porn|jeu|alcool|drogue)/.test(low)){
      msg( tr("Merci de m'en parler. On fait 4-7-8 : inspire 4s, retiens 7s, expire 8s.",
              "Thanks for sharing. Let’s do 4-7-8: inhale 4s, hold 7s, exhale 8s.") );
      setTimeout(()=> msg( tr("De 0 à 10, quelle est l'intensité ?", "From 0 to 10, how strong is it?") ), 3200);
      return;
    }
    if (/\b(10|9|8|7|6|5|4|3|2|1|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/.test(low)){
      msg( tr("OK. Choisis une alternative 3 min : marcher, boire de l'eau, musique ?",
               "OK. Pick a 3-minute alternative: walk, drink water, music?") );
      return;
    }
    if (/(walk|marche|eau|water|music|musique)/.test(low)){
      msg( tr("Parfait. Minuteur mental 3 minutes. À la fin, on note une victoire.",
              "Perfect. 3-minute mental timer. At the end we’ll log a victory.") );
      return;
    }
    msg( tr("Je t'écoute. Dis-m'en un peu plus.", "I'm listening. Tell me a bit more.") );
  }

  function toast(text){ alert(text); }

  // init
  applyLang();
  maybeShowGate();
})();