// 교육과정 페이지의 과목 탭 (국어·영어·수학)
(function () {
  var list = document.querySelector('[role="tablist"]');
  if (!list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

  function select(tab, moveFocus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (moveFocus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      select(tab, false);
      history.replaceState(null, '', '#' + tab.dataset.key);
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next, true);
    });
  });

  // 홈 화면의 "국어 과정 보기" 같은 링크(programs.html#korean)로 들어오면 해당 과목을 바로 보여 줌
  var fromHash = tabs.filter(function (t) { return '#' + t.dataset.key === location.hash; })[0];
  if (fromHash) select(fromHash, false);
})();
