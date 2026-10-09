// 모바일 메뉴 열고 닫기
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.sbs-mbar button');
  const menu = document.querySelector('.sbs-menu');
  if (!btn || !menu) return;
  const set = (open) => {
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('sbs-menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'CLOSE' : 'MENU';
  };
  btn.addEventListener('click', () => set(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
});
