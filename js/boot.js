// Runs before first paint (a plain script in <head>): applies the saved theme and display settings, so there is no flash.
try {
  var m = localStorage.getItem('localboost.theme');
  var d = JSON.parse(localStorage.getItem('arcton.display') || '{}');
  ['text', 'motion', 'contrast'].forEach(function (k) { if (d[k]) document.documentElement.dataset[k] = d[k]; });
  if (m) document.documentElement.dataset.theme = m;
  else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
} catch (e) { /* storage blocked: defaults */ }
