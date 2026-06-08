(function(){
var S = window.SlamMapEditor;
var parsePGM = S.parsePGM, encodePGM = S.encodePGM;
var SEMANTIC_FREE = S.SEMANTIC_FREE, SEMANTIC_KEEPOUT = S.SEMANTIC_KEEPOUT;
var SEMANTIC_PASSABLE = S.SEMANTIC_PASSABLE, SEMANTIC_GUIDANCE = S.SEMANTIC_GUIDANCE;
var getSpeedValue = S.getSpeedValue, getSemanticZoneType = S.getSemanticZoneType, getSemanticColor = S.getSemanticColor;

// ===== State =====
var yamlObj = null, yamlText = '', yamlName = 'map.yaml';
var pgm = null, pgmName = 'map.pgm';
var semanticMask = null;
var semanticMaskName = 'No Semantic Mask';

var tool = 'paint';
var shape = 'freehand';
var drawing = false;
var previewing = false;
var brush = 8;
var speedPercent = 50;
var zoom = 1, ZMIN = 0.25, ZMAX = 8, ZSTEP = 1.25;

// Panning
var isSpace = false, panning = false;
var panStartX = 0, panStartY = 0, panStartScrollL = 0, panStartScrollT = 0;

// Undo/Redo stacks
var undoStack = [];
var redoStack = [];
var currentStroke = null;
var touchedIndices = null;

// Shape start point (canvas coords)
var sx = 0, sy = 0;

// Filled rectangle
var filledRect = false;

// filename helpers
var isYaml = function(name){ return /\.ya?ml$/i.test(name); };
var isPgm  = function(name){ return /\.pgm$/i.test(name); };
var isMaskName = function(name){ return /_(semantic|keepout|speed|passable|guidance)\.(pgm|ya?ml)$/i.test(name) || /semantic|keepout|speed|passable|guidance/i.test(name); };

$('#filledRect').on('change', function () {
  filledRect = this.checked;
  clearPreview();
});
$('#filledRect').prop('checked', false);

// ===== Elements =====
var $yamlName = $('#yamlName'), $pgmName = $('#pgmName');
var mapCanvas = document.getElementById('mapCanvas');
var maskCanvas = document.getElementById('maskCanvas');
var previewCanvas = document.getElementById('previewCanvas');
var mapCtx = mapCanvas.getContext('2d');
var maskCtx = maskCanvas.getContext('2d');
var prevCtx = previewCanvas.getContext('2d');
var brushCursor = document.getElementById('brushCursor');
var viewport = document.getElementById('viewport');
var canvasWrap = document.getElementById('canvasWrap');

// ===== UI Handlers =====
$('.tool-btn').on('click', function () {
  $('.tool-btn').removeClass('active'); $(this).addClass('active');
  tool = $(this).data('tool');
  updateSpeedControlState();
});
$('.tool-btn[data-tool="paint"]').addClass('active');

$('.shape-btn').on('click', function () {
  $('.shape-btn').removeClass('active'); $(this).addClass('active');
  shape = $(this).data('shape');
  clearPreview();
});
$('.shape-btn[data-shape="freehand"]').addClass('active');

$('#brushSize').on('input change', function () {
  brush = parseInt(this.value, 10);
  $('#brushLabel').text(brush + ' px');
  updateBrushCursorSize();
});

$('#speedPercent').on('input change', function () {
  speedPercent = parseInt(this.value, 10);
  $('#speedLabel').text(speedPercent + '%');
});

function updateSpeedControlState() {
  if (tool === 'speed') $('#speedControl').addClass('active');
  else $('#speedControl').removeClass('active');
}

['#showKeepout', '#showSpeed', '#showPassable', '#showGuidance'].forEach(function(sel) {
  $(sel).on('change', function(){ redrawMask(); });
});

$('#invertDisplay, #autoLevels').on('change', function(){ redrawMap(); });

$('#btnLoadYaml').on('click', function(){ $('#yamlInput').click(); });
$('#btnLoadPgm').on('click', function(){ $('#pgmInput').click(); });
$('#yamlInput').on('change', function(e){ handleFiles(e.target.files); this.value = ''; });
$('#pgmInput').on('change', function(e){ handleFiles(e.target.files); this.value = ''; });

$('#zoomIn').on('click', function(){ setZoom(Math.min(ZMAX, zoom * ZSTEP)); });
$('#zoomOut').on('click', function(){ setZoom(Math.max(ZMIN, zoom / ZSTEP)); });
$('#zoomReset').on('click', function(){ setZoom(1); });

$('#btnUndo').on('click', undo);
$('#btnRedo').on('click', redo);

window.addEventListener('keydown', function(e) {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (e.code === 'Space') {
    if (!isSpace) { e.preventDefault(); isSpace = true; viewport.classList.add('panning'); }
  } else if (e.key === '+' || e.key === '=') { setZoom(Math.min(ZMAX, zoom * ZSTEP)); }
  else if (e.key === '-' || e.key === '_') { setZoom(Math.max(ZMIN, zoom / ZSTEP)); }
  else if (e.key === '0') { setZoom(1); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); }
});

window.addEventListener('keyup', function(e) {
  if (e.code === 'Space') {
    isSpace = false;
    viewport.classList.remove('panning');
    viewport.classList.remove('dragging');
  }
});

function sizeViewport() {
  var toolbarH = document.querySelector('.toolbar').offsetHeight;
  viewport.style.height = Math.max(200, window.innerHeight - toolbarH - 16) + 'px';
}
window.addEventListener('resize', sizeViewport);
sizeViewport();

// ===== Drag & Drop =====
var drop = document.getElementById('drop');
var stop = function(e){ e.preventDefault(); e.stopPropagation(); };
['dragenter','dragover','dragleave','drop'].forEach(function(n){ drop.addEventListener(n, stop, false); });
drop.addEventListener('dragover', function(){ drop.classList.add('drag'); });
drop.addEventListener('dragleave', function(){ drop.classList.remove('drag'); });
drop.addEventListener('drop', function(e){
  drop.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
});

// ===== Canvas sizing & zoom =====
function setZoom(z) {
  if (!pgm) return;
  zoom = z;
  var w = Math.round(pgm.width * zoom);
  var h = Math.round(pgm.height * zoom);
  [mapCanvas, maskCanvas, previewCanvas].forEach(function(cv){ cv.width = w; cv.height = h; });
  redrawMap(); redrawMask(); clearPreview();
  updateBrushCursorSize();
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function zoomAtClient(clientX, clientY, factor) {
  if (!pgm) return;
  var vpRect = viewport.getBoundingClientRect();
  var vx = clientX - vpRect.left;
  var vy = clientY - vpRect.top;
  var cxBefore = viewport.scrollLeft + vx;
  var cyBefore = viewport.scrollTop + vy;
  var mx = cxBefore / zoom;
  var my = cyBefore / zoom;
  var newZoom = clamp(zoom * factor, ZMIN, ZMAX);
  if (newZoom === zoom) return;
  setZoom(newZoom);
  var cxAfter = mx * zoom;
  var cyAfter = my * zoom;
  viewport.scrollLeft = Math.round(cxAfter - vx);
  viewport.scrollTop = Math.round(cyAfter - vy);
}

viewport.addEventListener('wheel', function(e) {
  if (!pgm) return;
  if (e.shiftKey) {
    e.preventDefault();
    var factor = (e.deltaY < 0) ? ZSTEP : (1 / ZSTEP);
    zoomAtClient(e.clientX, e.clientY, factor);
  }
}, { passive: false });

// ===== Coordinate transforms =====
function canvasToMap(cx, cy) { return [Math.floor(cx / zoom), Math.floor(cy / zoom)]; }

// ===== Brush cursor =====
function updateBrushCursorSize() {
  var d = Math.max(1, Math.round(brush * zoom));
  brushCursor.style.width = d + 'px';
  brushCursor.style.height = d + 'px';
}

function moveBrushCursor(evt) {
  var rect = mapCanvas.getBoundingClientRect();
  var client = evt.touches ? evt.touches[0] : evt;
  var x = client.clientX - rect.left;
  var y = client.clientY - rect.top;
  var d = Math.max(1, Math.round(brush * zoom));
  brushCursor.style.left = Math.round(x - d / 2) + 'px';
  brushCursor.style.top = Math.round(y - d / 2) + 'px';
}

mapCanvas.addEventListener('mouseenter', function(){ brushCursor.style.display = 'block'; updateBrushCursorSize(); });
mapCanvas.addEventListener('mouseleave', function(){ brushCursor.style.display = 'none'; });

// ===== Panning with spacebar / middle-button + drag =====
mapCanvas.addEventListener('mousedown', function(e) {
  if (e.button === 1 || isSpace) {
    e.preventDefault();
    panning = true;
    viewport.classList.add('dragging');
    panStartX = e.clientX; panStartY = e.clientY;
    panStartScrollL = viewport.scrollLeft; panStartScrollT = viewport.scrollTop;
  } else if (e.button === 0) {
    startDrawing(e.offsetX, e.offsetY);
  }
});

mapCanvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });

mapCanvas.addEventListener('mousemove', function(e) {
  moveBrushCursor(e);
  if (panning) {
    viewport.scrollLeft = panStartScrollL - (e.clientX - panStartX);
    viewport.scrollTop = panStartScrollT - (e.clientY - panStartY);
  } else if (drawing && shape === 'freehand') {
    paintAt(e.offsetX, e.offsetY);
  } else if (previewing && (shape === 'line' || shape === 'rect' || shape === 'measure')) {
    drawPreview(sx, sy, e.offsetX, e.offsetY);
  }
});

window.addEventListener('mouseup', function(e) {
  if (panning) { panning = false; viewport.classList.remove('dragging'); }
  if (e.button === 0) endDrawing(e);
});

mapCanvas.addEventListener('touchstart', function(e) {
  if (!pgm) return;
  e.preventDefault();
  var t = e.touches[0], rect = mapCanvas.getBoundingClientRect();
  var x = t.clientX - rect.left, y = t.clientY - rect.top;
  moveBrushCursor(e);
  startDrawing(x, y);
}, { passive: false });

mapCanvas.addEventListener('touchmove', function(e) {
  if (!pgm) return;
  e.preventDefault();
  var t = e.touches[0];
  var rect = mapCanvas.getBoundingClientRect();
  var x = t.clientX - rect.left, y = t.clientY - rect.top;
  moveBrushCursor(e);
  if (drawing && shape === 'freehand') { paintAt(x, y); }
  else if (previewing && (shape === 'line' || shape === 'rect' || shape === 'measure')) {
    drawPreview(sx, sy, x, y);
  }
}, { passive: false });

mapCanvas.addEventListener('touchend', function(e){ e.preventDefault(); endDrawing(); }, { passive: false });
mapCanvas.addEventListener('touchcancel', function(e){ e.preventDefault(); endDrawing(); }, { passive: false });

// ===== Drawing lifecycle =====
function startDrawing(cx, cy) {
  if (!pgm) return;
  if (shape === 'freehand') {
    drawing = true;
    beginStroke();
    paintAt(cx, cy);
  } else if (shape === 'line' || shape === 'rect' || shape === 'measure') {
    previewing = true;
    sx = cx; sy = cy;
    clearPreview();
    drawPreview(sx, sy, cx, cy);
  }
}

function endDrawing(e) {
  if (shape === 'freehand') {
    if (!drawing) return;
    drawing = false;
    finishStroke();
  } else if (previewing) {
    previewing = false;
    var rect = mapCanvas.getBoundingClientRect();
    var ex, ey;
    if (e && typeof e.clientX === 'number') {
      ex = e.clientX - rect.left; ey = e.clientY - rect.top;
    } else {
      ex = lastPreviewX != null ? lastPreviewX : sx;
      ey = lastPreviewY != null ? lastPreviewY : sy;
    }
    if (shape === 'measure') {
      setTimeout(function(){ clearPreview(); }, 5000);
      return;
    }
    clearPreview();
    beginStroke();
    if (shape === 'line') drawThickLine(sx, sy, ex, ey);
    else if (shape === 'rect') {
      drawFilledRect(sx, sy, ex, ey);
    }
    finishStroke();
  }
}

function beginStroke() { currentStroke = []; touchedIndices = new Set(); }

function finishStroke() {
  if (currentStroke && currentStroke.length) {
    undoStack.push(currentStroke);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  currentStroke = null; touchedIndices = null;
}

// ===== Undo/Redo =====
function undo() {
  var changeSet = undoStack.pop();
  if (!changeSet) return;
  var redoSet = [];
  for (var i = 0; i < changeSet.length; i++) {
    var ch = changeSet[i];
    var buf = (ch.layer === 'pgm') ? pgm.pixels : semanticMask;
    buf[ch.idx] = ch.prev;
    redoSet.push({ layer: ch.layer, idx: ch.idx, prev: ch.prev, next: ch.next });
  }
  redoStack.push(redoSet);
  redrawMap();
  redrawMask();
}

function redo() {
  var changeSet = redoStack.pop();
  if (!changeSet) return;
  var undoSet = [];
  for (var i = 0; i < changeSet.length; i++) {
    var ch = changeSet[i];
    var buf = (ch.layer === 'pgm') ? pgm.pixels : semanticMask;
    buf[ch.idx] = ch.next;
    undoSet.push({ layer: ch.layer, idx: ch.idx, prev: ch.prev, next: ch.next });
  }
  undoStack.push(undoSet);
  redrawMap();
  redrawMask();
}

// ===== Semantic tool helpers =====
function isSemanticTool() {
  return tool === 'mask' || tool === 'speed' || tool === 'passable' || tool === 'guidance';
}

function getSemanticToolValue() {
  if (tool === 'mask') return SEMANTIC_KEEPOUT;
  if (tool === 'speed') return getSpeedValue(speedPercent);
  if (tool === 'passable') return SEMANTIC_PASSABLE;
  if (tool === 'guidance') return SEMANTIC_GUIDANCE;
  return null;
}

// ===== Painting primitives =====
function paintAt(cx, cy) {
  if (!pgm) return;
  var mc = canvasToMap(cx, cy), mx = mc[0], my = mc[1];
  var rad = Math.max(1, Math.floor(brush / 2));
  var w = pgm.width, h = pgm.height, maxval = pgm.maxval;

  if (isSemanticTool()) {
    paintBuffer('semantic', semanticMask, w, h, mx, my, rad, getSemanticToolValue());
    redrawMask();
  } else if (tool === 'paint') {
    paintBuffer('pgm', pgm.pixels, w, h, mx, my, rad, 0);
    redrawMap();
  } else if (tool === 'erase') {
    paintBuffer('pgm', pgm.pixels, w, h, mx, my, rad, maxval);
    paintBuffer('semantic', semanticMask, w, h, mx, my, rad, SEMANTIC_FREE);
    redrawMap(); redrawMask();
  } else if (tool === 'unscan') {
    paintBuffer('pgm', pgm.pixels, w, h, mx, my, rad, getUnknownVal());
    redrawMap();
  }
}

function paintBuffer(layerName, buf, w, h, mx, my, rad, value) {
  for (var y = my - rad; y <= my + rad; y++) {
    if (y < 0 || y >= h) continue;
    for (var x = mx - rad; x <= mx + rad; x++) {
      if (x < 0 || x >= w) continue;
      var dx = x - mx, dy = y - my;
      if (dx * dx + dy * dy <= rad * rad) {
        var idx = y * w + x;
        if (touchedIndices && !touchedIndices.has(idx)) {
          if (currentStroke) currentStroke.push({ layer: layerName, idx: idx, prev: buf[idx], next: value });
          if (touchedIndices) touchedIndices.add(idx);
        }
        buf[idx] = value;
      }
    }
  }
}

function getUnknownVal() {
  var maxv = pgm ? pgm.maxval : 255;
  return Math.round(0.8039215686 * maxv);
}

function drawThickLine(cx1, cy1, cx2, cy2) {
  var p0 = canvasToMap(cx1, cy1), x0 = p0[0], y0 = p0[1];
  var p1 = canvasToMap(cx2, cy2), x1 = p1[0], y1 = p1[1];
  var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sdx = x0 < x1 ? 1 : -1;
  var sdy = y0 < y1 ? 1 : -1;
  var err = dx - dy;

  var w = pgm.width, h = pgm.height, maxval = pgm.maxval;
  var rad = Math.max(1, Math.floor(brush / 2));
  var unknown = getUnknownVal();

  var drawPoint = function(mx, my) {
    if (isSemanticTool()) {
      paintBuffer('semantic', semanticMask, w, h, mx, my, rad, getSemanticToolValue());
    } else if (tool === 'paint') {
      paintBuffer('pgm', pgm.pixels, w, h, mx, my, rad, 0);
    } else if (tool === 'erase') {
      paintBuffer('pgm', pgm.pixels, w, h, mx, my, rad, maxval);
      paintBuffer('semantic', semanticMask, w, h, mx, my, rad, SEMANTIC_FREE);
    } else if (tool === 'unscan') {
      paintBuffer('pgm', pgm.pixels, w, h, mx, my, rad, unknown);
    }
  };

  while (true) {
    drawPoint(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    var e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sdx; }
    if (e2 < dx) { err += dx; y0 += sdy; }
  }
  redrawMap(); redrawMask();
}

function drawThickRect(cx1, cy1, cx2, cy2) {
  var x1 = Math.min(cx1, cx2), y1 = Math.min(cy1, cy2);
  var x2 = Math.max(cx1, cx2), y2 = Math.max(cy1, cy2);
  drawThickLine(x1, y1, x2, y1);
  drawThickLine(x2, y1, x2, y2);
  drawThickLine(x2, y2, x1, y2);
  drawThickLine(x1, y2, x1, y1);
}

function drawFilledRect(cx1, cy1, cx2, cy2) {
  var x1 = Math.min(cx1, cx2), y1 = Math.min(cy1, cy2);
  var x2 = Math.max(cx1, cx2), y2 = Math.max(cy1, cy2);
  drawThickRect(x1, y1, x2, y2);

  var m1 = canvasToMap(x1, y1), mx1 = m1[0], my1 = m1[1];
  var m2 = canvasToMap(x2, y2), mx2 = m2[0], my2 = m2[1];
  var xMin = Math.max(0, Math.min(mx1, mx2));
  var yMin = Math.max(0, Math.min(my1, my2));
  var xMax = Math.min(pgm.width - 1, Math.max(mx1, mx2));
  var yMax = Math.min(pgm.height - 1, Math.max(my1, my2));
  var w = pgm.width, maxval = pgm.maxval;
  var unknown = getUnknownVal();

  var mapVal = null, semanticVal = null;
  if (tool === 'paint') mapVal = 0;
  else if (tool === 'erase') { mapVal = maxval; semanticVal = SEMANTIC_FREE; }
  else if (tool === 'unscan') mapVal = unknown;
  else if (isSemanticTool()) semanticVal = getSemanticToolValue();

  for (var y = yMin; y <= yMax; y++) {
    var rowBase = y * w;
    for (var x = xMin; x <= xMax; x++) {
      var idx = rowBase + x;
      if (mapVal !== null) setPixelWithUndo('pgm', pgm.pixels, idx, mapVal);
      if (semanticVal !== null) setPixelWithUndo('semantic', semanticMask, idx, semanticVal);
    }
  }
  redrawMap();
  redrawMask();
}

function setPixelWithUndo(layerName, buf, idx, value) {
  if (touchedIndices && !touchedIndices.has(idx)) {
    if (currentStroke) currentStroke.push({ layer: layerName, idx: idx, prev: buf[idx], next: value });
    touchedIndices.add(idx);
  }
  buf[idx] = value;
}

// ===== Preview overlay =====
var lastPreviewX = null, lastPreviewY = null;

function clearPreview() {
  prevCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  lastPreviewX = lastPreviewY = null;
}

function drawLabel(ctx, x, y, text) {
  ctx.save();
  ctx.font = Math.max(12, Math.round(12 * zoom)) + 'px Arial';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.fillStyle = 'white';
  ctx.strokeText(text, x + 6, y - 6);
  ctx.fillText(text, x + 6, y - 6);
  ctx.restore();
}

function getPreviewStrokeColor() {
  if (tool === 'mask') return 'rgba(190, 50, 50, 0.85)';
  if (tool === 'speed') return 'rgba(190, 170, 40, 0.85)';
  if (tool === 'passable') return 'rgba(50, 120, 190, 0.9)';
  if (tool === 'guidance') return 'rgba(40, 150, 60, 0.85)';
  if (tool === 'erase') return 'rgba(255, 255, 255, 0.85)';
  if (tool === 'unscan') return 'rgba(205, 205, 205, 0.9)';
  return 'rgba(0, 0, 0, 0.85)';
}

function getPreviewFillColor() {
  if (tool === 'mask') return 'rgba(190, 50, 50, 0.3)';
  if (tool === 'speed') return 'rgba(190, 170, 40, 0.3)';
  if (tool === 'passable') return 'rgba(50, 120, 190, 0.3)';
  if (tool === 'guidance') return 'rgba(40, 150, 60, 0.3)';
  if (tool === 'erase') return 'rgba(255, 255, 255, 0.25)';
  if (tool === 'unscan') return 'rgba(205, 205, 205, 0.25)';
  return 'rgba(0, 0, 0, 0.25)';
}

function drawPreview(cx1, cy1, cx2, cy2) {
  clearPreview();
  lastPreviewX = cx2; lastPreviewY = cy2;
  prevCtx.save();
  prevCtx.lineWidth = Math.max(1, Math.round(brush * zoom));
  prevCtx.lineCap = 'round';

  if (shape === 'line') {
    prevCtx.strokeStyle = getPreviewStrokeColor();
    prevCtx.beginPath(); prevCtx.moveTo(cx1, cy1); prevCtx.lineTo(cx2, cy2); prevCtx.stroke();
  } else if (shape === 'rect') {
    prevCtx.strokeStyle = getPreviewStrokeColor();
    var rx = Math.min(cx1, cx2), ry = Math.min(cy1, cy2);
    var rw = Math.abs(cx2 - cx1), rh = Math.abs(cy2 - cy1);
    if (filledRect) {
      prevCtx.fillStyle = getPreviewFillColor();
      prevCtx.fillRect(rx, ry, rw, rh);
    }
    prevCtx.strokeRect(rx, ry, rw, rh);
  } else if (shape === 'measure') {
    var lw = Math.max(1, Math.round(2 * zoom));
    prevCtx.lineWidth = lw;
    prevCtx.strokeStyle = 'rgba(0,150,255,0.9)';
    prevCtx.beginPath(); prevCtx.moveTo(cx1, cy1); prevCtx.lineTo(cx2, cy2); prevCtx.stroke();
    var mm1 = canvasToMap(cx1, cy1), mm2 = canvasToMap(cx2, cy2);
    var mdx = mm2[0] - mm1[0], mdy = mm2[1] - mm1[1];
    var pixDist = Math.sqrt(mdx * mdx + mdy * mdy);
    var res = (yamlObj && typeof yamlObj.resolution === 'number') ? yamlObj.resolution : 0.05;
    var meters = pixDist * res;
    var feet = meters * 3.28084;
    var txt = meters.toFixed(3) + ' m  (' + feet.toFixed(2) + ' ft)';
    drawLabel(prevCtx, cx2, cy2, txt);
  }
  prevCtx.restore();
}

// ===== File Loaders =====
function handleFiles(fileList) {
  var files = Array.from(fileList);
  if (files.length === 0) return;
  var byName = new Map(files.map(function(f){ return [f.name, f]; }));

  files.filter(function(f){ return isYaml(f.name); }).forEach(function(file) {
    readText(file).then(function(txt) {
      try {
        var yobj = jsyaml.load(txt);
        var isMask = isMaskName(file.name);
        if (isMask) {
          var imgField = (yobj && yobj.image) ? String(yobj.image) : '';
          var baseName = imgField.split('/').pop();
          if (baseName && byName.has(baseName)) {
            readBinary(byName.get(baseName)).then(function(buf) {
              loadSemanticPGM(baseName, new Uint8Array(buf));
            }).catch(function(err){ alert('Mask image load error: ' + err.message); });
          } else {
            console.warn('Drop the mask image "' + baseName + '" to view the semantic mask.');
          }
        } else {
          yamlText = txt;
          yamlObj = yobj;
          yamlName = file.name;
          $('#yamlPreview').text(txt);
          $yamlName.text(file.name);
          updateDebug();
        }
      } catch (e) {
        alert('YAML parse error in ' + file.name + ': ' + e.message);
      }
    });
  });

  files.filter(function(f){ return isPgm(f.name); }).forEach(function(file) {
    readBinary(file).then(function(buf) {
      var u8 = new Uint8Array(buf);
      if (isMaskName(file.name)) {
        loadSemanticPGM(file.name, u8);
      } else {
        loadBasePGM(file.name, u8);
      }
    }).catch(function(err){ alert('PGM parse error in ' + file.name + ': ' + err.message); });
  });
}

function readText(file) {
  return new Promise(function(res, rej) {
    var fr = new FileReader();
    fr.onload = function(){ res(fr.result); };
    fr.onerror = rej;
    fr.readAsText(file);
  });
}

function readBinary(file) {
  return new Promise(function(res, rej) {
    var fr = new FileReader();
    fr.onload = function(){ res(fr.result); };
    fr.onerror = rej;
    fr.readAsArrayBuffer(file);
  });
}

function loadBasePGM(filename, u8) {
  try {
    var parsed = parsePGM(u8);
    pgmName = filename;
    pgm = parsed;
    $pgmName.text(filename);
    if (!semanticMask || (semanticMask.length !== pgm.width * pgm.height)) {
      semanticMask = new Uint8ClampedArray(pgm.width * pgm.height);
      semanticMask.fill(SEMANTIC_FREE);
      semanticMaskName = 'No Semantic Mask';
      $('#semanticMaskName').text(semanticMaskName);
    }
    setupCanvasFromPGM();
  } catch (e) {
    alert('Base PGM load error: ' + e.message);
  }
}

function loadSemanticPGM(filename, u8) {
  try {
    var kpgm = parsePGM(u8);
    if (pgm && (kpgm.width !== pgm.width || kpgm.height !== pgm.height)) {
      alert('Semantic mask size ' + kpgm.width + 'x' + kpgm.height + ' does not match base map ' + pgm.width + 'x' + pgm.height + '. Skipping.');
      return;
    }
    var total = kpgm.width * kpgm.height;
    var dst = new Uint8ClampedArray(total);
    var maxv = kpgm.maxval || 255;
    if (kpgm.pixels.BYTES_PER_ELEMENT === 1 && maxv === 255) {
      dst.set(kpgm.pixels);
    } else {
      for (var i = 0; i < total; i++) {
        dst[i] = Math.round((kpgm.pixels[i] * 255) / maxv);
      }
    }
    semanticMask = dst;
    semanticMaskName = filename;
    $('#semanticMaskName').text(filename);
    if (pgm) {
      maskCanvas.width = Math.round(pgm.width * zoom);
      maskCanvas.height = Math.round(pgm.height * zoom);
      redrawMask();
    }
    updateDebug();
  } catch (e) {
    alert('Semantic PGM load error: ' + e.message);
  }
}

function setupCanvasFromPGM() {
  if (!pgm) return;
  [mapCanvas, maskCanvas, previewCanvas].forEach(function(cv) {
    cv.width = Math.round(pgm.width * zoom);
    cv.height = Math.round(pgm.height * zoom);
  });
  redrawMap(); redrawMask(); clearPreview(); updateBrushCursorSize();
  updateDebug();
}

function updateDebug() {
  if (!pgm) { $('#dbgInfo').text('\u2014'); return; }
  var maskStr = (typeof semanticMaskName === 'string' && semanticMaskName) ? semanticMaskName : 'No Semantic Mask';
  var neg = (yamlObj && yamlObj.negate != null) ? yamlObj.negate : '(n/a)';
  var zones = new Set();
  if (semanticMask) {
    for (var i = 0; i < semanticMask.length; i++) {
      var zt = getSemanticZoneType(semanticMask[i]);
      if (zt !== 'free') zones.add(zt);
    }
  }
  var zoneStr = zones.size > 0 ? Array.from(zones).join(', ') : 'none';
  $('#dbgInfo').text(
    'PGM: ' + pgm.width + '\u00D7' + pgm.height + ', maxval=' + pgm.maxval + ', magic=' + pgm.magic + '; ' +
    'YAML negate=' + neg + '; Semantic: ' + maskStr + '; Zones: ' + zoneStr
  );
}

// ===== Rendering =====
function redrawMap() {
  if (!pgm) return;
  var w = pgm.width, h = pgm.height, pixels = pgm.pixels, maxval = pgm.maxval;
  if (!w || !h || !maxval) return;
  var pmin = 65535, pmax = 0;
  if ($('#autoLevels').prop('checked')) {
    for (var i = 0; i < w * h; i++) { var v = pixels[i]; if (v < pmin) pmin = v; if (v > pmax) pmax = v; }
    if (pmax === pmin) { pmin = 0; pmax = maxval; }
  } else { pmin = 0; pmax = maxval; }
  var inv = $('#invertDisplay').prop('checked') || (yamlObj && Number(yamlObj.negate) === 1);
  var img = mapCtx.createImageData(w, h);
  var sc = (pmax > pmin) ? (255 / (pmax - pmin)) : 1;
  for (var i = 0; i < w * h; i++) {
    var g = Math.round((pixels[i] - pmin) * sc);
    if (g < 0) g = 0; else if (g > 255) g = 255;
    if (inv) g = 255 - g;
    img.data[4 * i + 0] = g; img.data[4 * i + 1] = g; img.data[4 * i + 2] = g; img.data[4 * i + 3] = 255;
  }
  var tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(img, 0, 0);
  mapCtx.imageSmoothingEnabled = false;
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.drawImage(tmp, 0, 0, mapCanvas.width, mapCanvas.height);
}

function redrawMask() {
  if (!pgm || !semanticMask) return;
  var w = pgm.width, h = pgm.height;
  var img = maskCtx.createImageData(w, h);
  var vis = {
    keepout: $('#showKeepout').prop('checked'),
    speed: $('#showSpeed').prop('checked'),
    passable: $('#showPassable').prop('checked'),
    guidance: $('#showGuidance').prop('checked')
  };
  for (var i = 0; i < w * h; i++) {
    var value = semanticMask[i];
    var c = getSemanticColor(value, vis);
    img.data[4 * i + 0] = c[0];
    img.data[4 * i + 1] = c[1];
    img.data[4 * i + 2] = c[2];
    img.data[4 * i + 3] = c[3];
  }
  var tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(img, 0, 0);
  maskCtx.imageSmoothingEnabled = false;
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.drawImage(tmp, 0, 0, maskCanvas.width, maskCanvas.height);
}

// ===== Downloads =====
function dlBytes(bytes, filename, mime) {
  var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function dlText(txt, filename, mime) {
  var blob = new Blob([txt], { type: mime || 'text/yaml' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function buildUpdatedYaml(imageName) {
  if (!yamlObj) return '';
  var y = Object.assign({}, yamlObj, { image: imageName });
  return jsyaml.dump(y);
}

$('#btnDownloadMap').on('click', function() {
  if (!pgm || !yamlObj) { alert('Load YAML and PGM first.'); return; }
  var pgmBytes = encodePGM(pgm);
  var outPgm = 'map_edited.pgm';
  var outYaml = 'map_edited.yaml';
  dlBytes(pgmBytes, outPgm, 'image/x-portable-graymap');
  dlText(buildUpdatedYaml(outPgm), outYaml, 'text/yaml');
});

function downloadFilterMask(filterType) {
  if (!pgm || !yamlObj || !semanticMask) { alert('Load YAML and PGM first.'); return; }
  var len = pgm.width * pgm.height;
  var pixels = new Uint8ClampedArray(len);
  var freeVal = (filterType === 'speed') ? 255 : (filterType === 'passable' || filterType === 'guidance') ? 0 : 254;
  for (var i = 0; i < len; i++) {
    var zone = S.getSemanticZoneType(semanticMask[i]);
    if (zone === filterType) {
      if (filterType === 'speed') {
        pixels[i] = 255 - Math.round(semanticMask[i] * 255 / 100);
      } else if (filterType === 'passable' || filterType === 'guidance') {
        pixels[i] = 254;
      } else {
        pixels[i] = semanticMask[i];
      }
    } else {
      pixels[i] = freeVal;
    }
  }
  var m = { magic: 'P5', width: pgm.width, height: pgm.height, maxval: 255, pixels: pixels };
  var outPgm = filterType + '_mask.pgm';
  var outYaml = filterType + '_mask.yaml';
  var y = Object.assign({}, yamlObj, { image: outPgm });
  if (filterType === 'speed') {
    y.mode = 'scale';
    y.occupied_thresh = 1.0;
    y.free_thresh = 0.0;
  }
  dlBytes(encodePGM(m), outPgm, 'image/x-portable-graymap');
  dlText(jsyaml.dump(y), outYaml, 'text/yaml');
}

$('#btnDownloadSemantic').on('click', function() {
  if (!pgm || !yamlObj || !semanticMask) { alert('Load YAML and PGM first.'); return; }
  var m = { magic: 'P5', width: pgm.width, height: pgm.height, maxval: 255, pixels: semanticMask };
  var semanticBytes = encodePGM(m);
  var outPgm = 'semantic_mask.pgm';
  var outYaml = 'semantic_mask.yaml';
  var y = Object.assign({}, yamlObj, { image: outPgm });
  dlBytes(semanticBytes, outPgm, 'image/x-portable-graymap');
  dlText(jsyaml.dump(y), outYaml, 'text/yaml');
});

$('#dlFilterAll').on('click', function(e) { e.preventDefault(); $('#btnDownloadSemantic').click(); });
$('#dlFilterKeepout').on('click', function(e) { e.preventDefault(); downloadFilterMask('keepout'); });
$('#dlFilterSpeed').on('click', function(e) { e.preventDefault(); downloadFilterMask('speed'); });
$('#dlFilterPassable').on('click', function(e) { e.preventDefault(); downloadFilterMask('passable'); });
$('#dlFilterGuidance').on('click', function(e) { e.preventDefault(); downloadFilterMask('guidance'); });

})();
