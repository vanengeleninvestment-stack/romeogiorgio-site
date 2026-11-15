/* Vervangt emoji in de spellen door de eigen tekeningen (img/e/<code>.webp).
   De emoji zelf blijft onzichtbaar in de tekst staan, zodat de spelcode niets merkt.
   Lijst van beschikbare tekeningen: img/e/lijst.js (window.TEKENINGEN). */
(function(){
  const OK=new Set(window.TEKENINGEN||[]);
  if(!OK.size)return;
  const RE=/(?:[0-9#*]️?⃣)|(?:\p{Regional_Indicator}{2})|(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)/gu;
  const code=e=>[...e].map(c=>c.codePointAt(0).toString(16)).filter(c=>c!=='fe0f').join('-');
  const src=k=>'img/e/'+k+'.webp';
  const css=document.createElement('style');
  css.textContent='.em{display:inline-block;width:1.18em;height:1.18em;vertical-align:-.18em;background:center/contain no-repeat;line-height:1}'+
    '.em>i{font-style:normal;opacity:0;display:inline-block;width:0;overflow:hidden}';
  document.head.appendChild(css);
  // Afbeeldingen alvast laden
  const SKIPTAG=/^(SCRIPT|STYLE|TEXTAREA|OPTION|SELECT|TITLE|INPUT)$/;

  function doText(node){
    const s=node.nodeValue;if(!s||!RE.test(s)){RE.lastIndex=0;return;}RE.lastIndex=0;
    const p=node.parentNode;if(!p||SKIPTAG.test(p.nodeName)||p.closest('.em,svg'))return;
    let last=0,frag=null;
    for(const m of s.matchAll(RE)){
      const k=code(m[0]);if(!OK.has(k))continue;
      frag=frag||document.createDocumentFragment();
      if(m.index>last)frag.appendChild(document.createTextNode(s.slice(last,m.index)));
      const sp=document.createElement('span');sp.className='em';sp.style.backgroundImage='url('+src(k)+')';
      const i=document.createElement('i');i.textContent=m[0];sp.appendChild(i);frag.appendChild(sp);
      last=m.index+m[0].length;
    }
    if(!frag)return;
    if(last<s.length)frag.appendChild(document.createTextNode(s.slice(last)));
    p.replaceChild(frag,node);
  }

  // SVG: <text> met alleen een emoji krijgt een <image> erbovenop met dezelfde plek, transform en doorzichtigheid.
  const NS='http://www.w3.org/2000/svg';
  function doSvgText(t){
    const e=(t.textContent||'').trim();const k=e&&code(e);
    const ok=k&&OK.has(k)&&e.match(RE)&&e.match(RE)[0]===e;
    if(!ok){if(t._img){t._img.remove();t._img=null;t.style.opacity=t.dataset.op||'';}return;}
    let im=t._img;
    if(!im){im=document.createElementNS(NS,'image');im.setAttribute('pointer-events','none');im.setAttribute('preserveAspectRatio','xMidYMid meet');t._img=im;}
    if(im.parentNode!==t.parentNode||im.previousSibling!==t)t.parentNode.insertBefore(im,t.nextSibling);
    im.setAttribute('href',src(k));
    if(t.style.opacity!=='0')t.style.opacity='0';
    let b;try{b=t.getBBox();}catch(_){return;}
    if(!b.width&&!b.height)return;
    const fs=parseFloat(t.getAttribute('font-size'))||b.height;const sz=Math.max(b.height*.92,fs*1.05);
    const cx=b.x+b.width/2,cy=b.y+b.height/2;
    im.setAttribute('x',cx-sz/2);im.setAttribute('y',cy-sz/2);im.setAttribute('width',sz);im.setAttribute('height',sz);
    for(const a of ['transform','opacity','class','display','visibility'])
      t.hasAttribute(a)?im.setAttribute(a,t.getAttribute(a)):im.removeAttribute(a);
    // doorzichtigheid via style (bijv. animaties) overnemen
    const so=t.dataset.op;im.style.opacity=so||'';
  }

  let queued=new Set(),raf=0;
  function flush(){raf=0;const q=[...queued];queued.clear();
    for(const n of q){
      if(!n.isConnected)continue;
      if(n.nodeType===3){const p=n.parentNode;if(p&&p.namespaceURI===NS&&p.closest('text'))queueSvg(p.closest('text'));else doText(n);}
      else if(n.nodeType===1){
        if(n.namespaceURI===NS){(n.tagName==='text'?[n]:n.querySelectorAll('text')).forEach(doSvgText);}
        else{const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);const ts=[];while(w.nextNode())ts.push(w.currentNode);ts.forEach(doText);n.querySelectorAll('svg text').forEach(doSvgText);}
      }
    }
  }
  function queueSvg(t){queued.add(t);if(!raf)raf=requestAnimationFrame(flush);}
  function add(n){queued.add(n);if(!raf)raf=requestAnimationFrame(flush);}
  new MutationObserver(ms=>{for(const m of ms){
    if(m.type==='childList'){m.addedNodes.forEach(n=>{if(n.nodeType===1&&(n.classList&&n.classList.contains('em')||n.tagName==='image'))return;add(n);});
      if(m.target.namespaceURI===NS&&m.target.closest&&m.target.closest('text'))add(m.target.closest('text'));}
    else if(m.type==='characterData'){add(m.target);}
    else if(m.type==='attributes'){const t=m.target;if(t.tagName==='text'&&t._img){if(m.attributeName==='style'){/* spel zet zelf opacity */const o=t.style.opacity;if(o!=='0'){t.dataset.op=o;t.style.opacity='0';}}add(t);}
      else if(t.namespaceURI===NS&&t.tagName!=='image'){t.querySelectorAll&&t.querySelectorAll('text').forEach(x=>x._img&&add(x));}}
  }}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['x','y','transform','opacity','style','class','font-size','display','visibility']});
  add(document.body);flush();
  addEventListener('resize',()=>document.querySelectorAll('svg text').forEach(t=>t._img&&add(t)));
})();
