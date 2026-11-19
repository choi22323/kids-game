/* 안전한 DOM 생성 헬퍼 — 문자열은 항상 textContent로 넣는다 (CLAUDE.md §5.2) */
(function () {
  'use strict';
  const PROPS = ['value', 'checked', 'disabled', 'selected', 'hidden', 'tabIndex'];
  function append(el, kids) {
    kids.forEach((k) => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    });
  }
  function apply(el, props) {
    if (!props) return;
    Object.keys(props).forEach((k) => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach((ev) => el.addEventListener(ev, v[ev]));
      else if (k === 'style') Object.keys(v).forEach((p) => el.style.setProperty(p, v[p]));
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (PROPS.includes(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    apply(el, props);
    append(el, kids);
    return el;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  HG.dom = { h, svg, clear, $, append };
})();
