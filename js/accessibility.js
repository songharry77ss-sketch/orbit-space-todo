/* Dialog and sheet focus: keep the current task reachable by keyboard. */
"use strict";

const FocusScope = {
  stack: [], baseline: new Map(),
  selector: 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  init() {
    document.addEventListener("keydown", e => {
      const top = this.stack.at(-1);
      if (!top?.modal || e.key !== "Tab") return;
      const items = this.items(top.root), first = items[0], last = items.at(-1);
      if (!first) { e.preventDefault(); this.focus(top); return; }
      if (!items.includes(document.activeElement) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }, true);
    document.addEventListener("focusin", e => {
      const top = this.stack.at(-1);
      if (top?.modal && !top.root.contains(e.target)) this.focus(top);
    });
  },
  items(root) { return [...root.querySelectorAll(this.selector)].filter(el => el.getClientRects().length && !el.closest('[hidden], [inert]')); },
  remember(el = document.activeElement) {
    const row = el?.closest('[data-task], [data-id]');
    return { node: el, id: el?.id, rowId: row?.dataset.task || row?.dataset.id, action: el?.dataset.act, value: el?.dataset.v, container: el?.closest('#listView, #board, #calendar, #sheet, #nowbar')?.id };
  },
  restore(saved) {
    let el = saved?.node;
    if (!el?.isConnected || !el.getClientRects().length) el = saved?.id ? document.getElementById(saved.id) : null;
    if ((!el || !el.getClientRects().length) && (saved?.rowId || saved?.action)) {
      const container = document.getElementById(saved.container) || document;
      const row = saved.rowId ? [...container.querySelectorAll('[data-task], [data-id]')].find(n => (n.dataset.task || n.dataset.id) === saved.rowId) : container;
      el = saved.action ? [...(row?.querySelectorAll('[data-act]') || [])].find(n => n.dataset.act === saved.action && (saved.value == null || n.dataset.v === saved.value)) : row;
    }
    if (!el?.isConnected || !el.getClientRects().length || el.closest('[inert]')) el = this.stack.at(-1)?.root || document.querySelector('.seg-btn[aria-selected="true"]');
    el?.focus({ preventScroll: true });
  },
  open(root, { modal = true, initial } = {}) {
    let entry = this.stack.find(x => x.root === root);
    if (!entry) { entry = { root, modal, initial, returnTo: this.remember() }; this.stack.push(entry); }
    else { entry.modal = modal; entry.initial = initial; }
    this.sync();
    requestAnimationFrame(() => { if (this.stack.at(-1) === entry && !root.hidden) this.focus(entry); });
  },
  focus(entry) {
    let el = typeof entry.initial === 'string' ? entry.root.querySelector(entry.initial) : entry.initial;
    if (!el?.isConnected || !el.getClientRects().length) el = this.items(entry.root)[0] || entry.root.querySelector('[role="dialog"]') || entry.root;
    el.focus({ preventScroll: true });
  },
  close(root, restore = true) {
    const i = this.stack.findIndex(x => x.root === root); if (i < 0) return;
    const entry = this.stack[i], wasTop = i === this.stack.length - 1;
    this.stack.splice(i, 1); this.sync();
    if (restore && wasTop) this.restore(entry.returnTo);
  },
  setModal(root, modal) { const entry = this.stack.find(x => x.root === root); if (entry) { entry.modal = modal; this.sync(); } },
  sync() {
    const top = this.stack.at(-1), modalRoot = top?.modal ? top.root : null;
    if (modalRoot) {
      for (const el of document.body.children) {
        if (el.matches('script, style, #toasts')) continue;
        if (!this.baseline.has(el)) this.baseline.set(el, el.inert);
        el.inert = !el.contains(modalRoot) && !(el.id === "sheetBackdrop" && modalRoot.id === "sheet");
      }
    } else {
      this.baseline.forEach((inert, el) => { el.inert = inert; }); this.baseline.clear();
    }
  },
};
