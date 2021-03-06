class Mechanical {
  constructor(){ this.editMech = 0; }

  createItem(op, pos, content, by){
    var item = {
      id: this.editMech,
      op: op,
      pos: pos,
      content: content,
      by: by,
      timestamp: getTime()
    };
    this.editMech++;

    return item;
  }
}

class Structural {
  constructor(){
    this.editStruct = 0;
    this.lastUpdate = {
      stack : getTime(),
      reverted : getTime()
    };
    this.stackStruct = [];
    this.revertedStruct = [];
  }

  createItem(op, by, items, newMap, oldMap){
    var item = {
      id: this.editStruct,
      op: op,
      by: by,
      timestamp: getTime(),
      items: items,
      newMap: newMap, // Serve per l'undo per mettere il cursore esattamente dove stava
      oldMap: oldMap  // Serve per l'undo per mettere il cursore esattamente dove stava
    };
    this.editStruct++;

    if (this.updateItem(item) == false) this.stackStruct.push(item);

    // Se si fanno delle modifiche la coda con gli undo annulati va svuotata
    if (this.emptyRevertedStruct()) this.updateTimes(2);
    else this.updateTimes(1);
  }


  updateItem(item){
    var st = this.lastItem();

    if (st == undefined) return false;
    if (compareTime(st.items[0].timestamp, getTime(), interval) == false) return false;

    var rule;

    if (st.op == "TEXTDELETE" && item.op == "TEXTDELETE" && st.items[0].pos-item.items[0].content.length == item.items[0].pos){
      st.newMap = item.items[0].newMap;
      st.items[0].timestamp = getTime();
      st.items[0].pos = item.items[0].pos;
      st.items[0].content = item.items[0].content + st.items[0].content;

      rule = 1;
    }
    else if (st.op == "TEXTINSERT" && item.op == "TEXTINSERT" && st.items[0].pos+st.items[0].content.length == item.items[0].pos){
      st.newMap = item.items[0].newMap;
      st.items[0].timestamp = getTime();
      st.items[0].content = st.items[0].content + item.items[0].content;

      rule = 2;
    }
    else if ((st.op == "CHANGE" || st.op == "TEXTREPLACE") && item.op == "TEXTREPLACE" && st.items[1].content.slice(-6) == "&nbsp;" && item.items[0].content.slice(0,6) == "&nbsp;" && item.items[1].content.slice(0,1) == " "){// && item st.items[1].pos+st.items[1].content.length == item.items[0].pos){
      st.newMap = item.items[0].newMap;
      st.items[1].timestamp = getTime();
      st.items[1].content = st.items[1].content.slice(0,-6) + item.items[1].content;

      rule = 3;
    }
    else if (st.op == "TEXTINSERT" && item.op == "TEXTREPLACE" && item.items[0].content == "&nbsp;" && st.items[0].content.slice(-6)){
      st.newMap = item.items[0].newMap;
      st.items[0].timestamp = getTime();
      st.items[0].content = st.items[0].content.slice(0,-6) + item.items[1].content;

      rule = 4;
    }
    else if ((st.op == "CHANGE" || st.op == "TEXTREPLACE") && item.op == "TEXTINSERT" && st.items[1].pos+st.items[1].content.length == item.items[0].pos){
      st.newMap = item.items[0].newMap;
      st.items[1].timestamp = getTime();
      st.items[1].content = st.items[1].content + item.items[0].content;

      rule = 5;
    }/*
    else if (st.op == "TEXTREPLACE" && item.op == "TEXTDELETE" && (st.items[1].pos == item.items[0].pos && )){
      console.log(st.items[0].pos, item.items[0].pos, item.items[0].content.length, st.items[0].pos - item.items[0].content.length == item.items[0].pos );

      st.newMap = item.items[0].newMap;
      st.items[0].timestamp = getTime();
      st.items[0].pos = item.items[0].pos;
      st.items[0].content = item.items[0].content + st.items[0].content;

      rule = 6;
    }*/
    else {
      //console.log(st,item);
      return false;
    }

    if (log) console.log(`Applied update rule N:${rule}`)
    return true;
  }

  updateTimes(mode){
    this.lastUpdate.stack = getTime();
    if (mode>=2) this.lastUpdate.reverted = getTime();
  }

  remItem() {
    this.updateTimes(2);
    return pop_move(this.stackStruct, this.revertedStruct);
  }
  remRevert() {
    this.updateTimes(2);
    return pop_move(this.revertedStruct, this.stackStruct);
  }

  lastItem() { return this.stackStruct[this.stackStruct.length-1]; }

  emptyRevertedStruct() {
    if (this.revertedStruct == []) return false;
    else {
      this.revertedStruct = [];
      return true;
    }
  }
}

// Dichiaro le variabili globali
var oldState, ed, by, log, interval, struct, mech, convertion;
// Funzione di inizializzazione
function initLightly(param){
  ed = param.ed != undefined ? param.ed : tinyMCE.activeEditor.dom.doc.body;
  by = param.by != undefined ? param.by : "";
  log = param.log != undefined ? param.log : false;
  interval = param.interval != undefined ? param.interval : 3;
  convertion = param.convertion != undefined ? param.convertion : [];

  mech = new Mechanical();
  struct = new Structural();

  catchChange();
}

// Cerca il cambiamento nella stringa e lo salva
function catchChange(startNode, oldMap){
  newState = catchState();
  if (oldState == undefined) oldState = newState;
  else if (oldState == newState) { if (log) { console.log(""); console.log('State Unchanged');} }
  else {
    if (log) console.log("");
    var pos = startNode==undefined ? {start: 0, end: 0} : getAbsPos(startNode);
    // Controllo da sinistra verso destra
    var start = sanitizeNum(pos.start, Math.min(oldState.length, newState.length));
    while ( start < newState.length && start < oldState.length && newState[start] == oldState[start] ) { start ++; }

    // Controllo da destra verso sinistra
    var newEnd = newState.length -1 - pos.end; // Se c'è stato quache cambiamento allora è probabile che la lunghezza tra le 2 stringhe è cambiata
    var oldEnd = oldState.length -1 - pos.end; // Se c'è stato quache cambiamento allora è probabile che la lunghezza tra le 2 stringhe è cambiata
    while ( newEnd >= start && oldEnd >= start && newState[newEnd] == oldState[oldEnd]) { newEnd --; oldEnd --;}

    var del = oldState.slice(start,oldEnd+1);
    var add = newState.slice(start,newEnd+1);

    if (oldState.length-del.length+add.length != newState.length) {
      if (log) {
        console.log(`State chatch error: missing ${Math.abs(oldState.length-del.length+add.length-newState.length)} char`);
        console.log("DEL: ",del);
        console.log("ADD: ",add);
      }
      catchChange(undefined, oldMap);
    }
    else {
      insItem(add, del, start, oldMap);
      if (log) {
        var range = 30;
        console.log(`State Changed "%c${cutString(del,range)}%c" into "%c${cutString(add,range)}%c" at pos %c${start}`,"color: red","","color: red","","font-weight: bold");
      }
      oldState = newState;
    }
  }
}

// Capisce  il tipo di cambiamento e lo inserisce
function insItem(add, del, pos, oldMap){
  var items = [];

  var a = add.split(/(<[^<>]*>|[^<>]*>|<[^<>]*)/);
  var d = del.split(/(<[^<>]*>|[^<>]*>|<[^<>]*)/);

  var newMap = createMap();
  var st = struct.lastItem();


  if (del != "" && add == "") {
    items[items.length] = mech.createItem("DEL", pos, del, by);
    if (d.length == 1) struct.createItem("TEXTDELETE", by, items, newMap, oldMap);
    else               struct.createItem("DELETE", by, items, newMap, oldMap);
  }
  else if (add != "" && del == "") {
    items[items.length] = mech.createItem("INS", pos, add, by);
    if (a.length == 1) struct.createItem("TEXTINSERT", by, items, newMap, oldMap);
    else               struct.createItem("INSERT", by, items, newMap, oldMap);
  }
  else if (a.slice(2,a.length-2).join("") == del) {
    items[items.length] = mech.createItem("INS", pos, a[1], by);
    items[items.length] = mech.createItem("INS", pos+a.slice(0,a.length-2).join("").length, a[a.length-2], by, newMap, oldMap);
    struct.createItem("WRAP", by, items, newMap, oldMap);
  }
  else if (a.slice(2,a.length-2).join("") == "<"+del+">") {
    items[items.length] = mech.createItem("INS", pos-1, "<"+a[1], by);
    items[items.length] = mech.createItem("INS", pos+a.slice(0,a.length-2).join("").length, a[a.length-2]+">", by, newMap, oldMap);
    struct.createItem("WRAP", by, items, newMap, oldMap);
  }
  else if (d.slice(2,d.length-2).join("") == add) {
    items[items.length] = mech.createItem("DEL", pos, d[1], by);
    items[items.length] = mech.createItem("DEL", pos+d.slice(2,d.length-2).join("").length, d[d.length-2], by, newMap, oldMap);
    struct.createItem("UNWRAP", by, items, newMap, oldMap);
  }
  else if (d.slice(2,d.length-2).join("") == "<"+add+">") { // Da finire
    items[items.length] = mech.createItem("DEL", pos-1, "<"+d[1], by);
    items[items.length] = mech.createItem("DEL", pos+d.slice(2,d.length-2).join("").length-1, d[d.length-2]+">", by, newMap, oldMap);
    struct.createItem("UNWRAP", by, items, newMap, oldMap);
  }
  else if (a.length>=5 && d.length>=5 &&  a.slice(2,a.length-2).join("") == d.slice(2,d.length-2).join("")) {
    items[items.length] = mech.createItem("DEL", pos, d[1], by);
    items[items.length] = mech.createItem("DEL", pos+d.slice(2,d.length-2).join("").length, d[d.length-2], by, newMap, oldMap);
    items[items.length] = mech.createItem("INS", pos, a[1], by);
    items[items.length] = mech.createItem("INS", pos+a.slice(0,a.length-2).join("").length, a[a.length-2], by, newMap, oldMap);
    struct.createItem("REPLACE", by, items, newMap, oldMap);
  }
  else {
    items[items.length] = mech.createItem("DEL", pos, del, by);
    items[items.length] = mech.createItem("INS", pos, add, by);
    if (a.length == 1 && d.length == 1) struct.createItem("TEXTREPLACE", by, items, newMap, oldMap);
    else                                struct.createItem("CHANGE", by, items, newMap, oldMap);
  }

  if (log) console.log("ADD:",a,"\nDEL:",d,`\nChange type: ${struct.lastItem().op}`);
}

// Se viende scatenato prende le ultime due modifiche scritte nella pila scelta in base al tipo (UNDO o REUNDO) e le applica
function revertChange(type) {
  // Se la pila è vuota undoChange non deve fare nulla
  if (log) console.log("");
  if (type == "UNDO" && struct.stackStruct.length == 0) { if (log) console.log("Undo stack is empty"); }
  else if (type == "REDO" && struct.revertedStruct.length == 0) { if (log) console.log("Redo stack is empty"); }
  else if (type == "REDO" || type == "UNDO"){
    var state = oldState;

    var range = 30; // Per il log

    var st = type == "UNDO" ? struct.remItem() : struct.remRevert();
    var items = st.items;

    for (var i = 0; i < items.length; i++) {
      let index = type == "UNDO" ? items.length-1-i : i; // Il verso di lettura dipende se è un undo <- o un redo ->
      let item = items[index];
      if ((type == "UNDO" && item.op == "INS") || (type == "REDO" &&  item.op == "DEL")){
        // Caso di rimozione
        state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
        if (log) console.log(`Removed "%c${cutString(item.content,range)}%c" at pos %c${item.pos}`,"color: red","","font-weight: bold");
      }
      else {
        // Caso di aggiunta
        state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
        if (log) console.log(`Added "%c${cutString(item.content,range)}%c" at pos %c${item.pos}`,"color: red","","font-weight: bold");
      }
    }

    loadState(state);

    // Se è Undo il primo elemento letto è l'ultimo dell'array altrimenti è il primo
    setCursorPos(type == "UNDO" ? st.oldMap : st.newMap);
  }
}

// Ottieni il blocco della stringa in base alla pos del puntatore
function getAbsPos(sc) {
  var r = range();

  var startContainer = sc;
  var endContainer = r.endContainer;

  // Calcolo start
  let start = 0;
  var walker = stepBackNode(goToMainNode(startContainer));
  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    if (walker.outerHTML != undefined) start += walker.outerHTML.length; // Se sono dentro un nodo che ne contiene altri, non ha senso che entro nei sottonodi, prendo la lunghezza totale
    else start += walker.nodeValue.length; // Altrimenti se sono dentro un nodo testo prendo la lungezza della stringa
    walker = stepBackNode(walker);
  }

  // Calcolo end
  let end = 0;
  // Nel caso in cui ci sono più nodi uguali è necessario controllare tutto l'insieme
  walker = stepNextNode(goToMainNode(endContainer));
  while (walker.outerHTML == stepNextNode(walker).outerHTML && !Array.from(ed.parentNode.children).includes(walker)) walker = stepNextNode(walker);
  walker = stepNextNode(walker);

  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    if (walker.outerHTML != undefined) end += walker.outerHTML.length;
    else end += walker.nodeValue.length;
    walker = stepNextNode(walker);
  }

  if (log) {
    var rng = 20;
    var state = catchState(), stateLen = state.length-1, endP =  stateLen - end + 1;
    console.log(`Range is from pos %c${start}%c to %c${endP}%c\n${state.slice(sanitizeNum(start-rng, stateLen), start)}%c${state.slice(start, endP)}%c${state.slice(endP, sanitizeNum(endP+rng,stateLen))}`,"font-weight: bold","","font-weight: bold","","color: red","");
  }

  return ({ start: start, end: end });
}

// Mette il cursore sul dom
function setCursorPos(map){
  ed.focus();

  var start = navigateMap(map.start);
  var end = navigateMap(map.end);

  var sSize = start.node.innerText != null ? start.node.innerText.length : start.node.valueOf().length;
  var eSize = end.node.innerText != null ? end.node.innerText.length : end.node.valueOf().length;

  r = range();
  r.setStart(start.node, sanitizeNum(start.offset, sSize));
  r.setEnd(end.node, sanitizeNum(end.offset, eSize));
}

// Map serve per ottenere la posizione dei nodi
function createMap() {
  function genBracket(node, offset){
    var map = {child: null, offset: offset};
    if (node != ed) {
      do {
        let index = Array.from(node.parentNode.childNodes).findIndex((elem) => elem == node);
        map = {child: map, offset: index};
        node = node.parentNode;
      } while (node != ed);
    }
    else map = {child: map, offset: 0};

    return (map);
  }

  ed.normalize();
  var r = range();
  var bracket = genBracket(r.startContainer, r.startOffset);

  var ret = { start: bracket };
  ret.end = (r.startContainer==r.endContainer&&r.startOffset==r.endOffset) ? bracket : genBracket(r.endContainer, r.endOffset);

  return ret;
}
function navigateMap(map){
  var node = ed;
  var flag = true;
  while (map.child != null && flag){
    let offset = sanitizeNum(map.offset, node.childNodes.length-1);
    if (node.childNodes[offset] == undefined) flag = false;
    else {
      node = node.childNodes[offset];
      map = map.child;
    }
  }
  return {node: node, offset: map.offset};
}

var stack = {
  stack : { list: [], time: ""},
  reverted : { list: [], time: ""}
};
function getStackStruct(){ return sanitizeTINY("stack", struct.stackStruct);}
function getRevertedStruct(){ return sanitizeTINY("reverted", struct.revertedStruct);}
function sanitizeTINY(op, st){
  if (stack[op].time=="" || struct.lastUpdate[op] > stack[op].time){
    stack[op].time = struct.lastUpdate[op];
    stack[op].list = JSON.parse(JSON.stringify(st));
    convertion.forEach((rule, r) => {
      stack[op].list.forEach((item, i) => {
        item.items.forEach((mec, m) => {
          mec.content = mec.content.replace(rule.original, rule.new);
        });
      });
    });
  }
  return stack[op];
}

tinymce.PluginManager.add('lightly', function(editor, url) {
  // Disabilita l'undo built in
  editor.on('BeforeAddUndo', function(e) { return false; });

  editor.ui.registry.addButton('lightly-Undo', {
    text: 'Undo',
    icon: 'undo',
    tooltip: 'Ctrl + Z',
    onAction: function () { revertChange("UNDO"); }
  });
  editor.ui.registry.addButton('lightly-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'Ctrl + Y',
    onAction: function () { revertChange("REDO"); }
  });

  editor.on('init', function() {
    initLightly({
      by: "Francesco Fornari",
      ed: tinyMCE.activeEditor.dom.doc.body,
      interval: 3,
      log: false,
      convertion: [{ original: /&nbsp;/g, new:" "}]
    });
    if (log) console.log("lightly ready");
  });

  // Catturo la posizione del cursore prima dell modifica per controllare le modifiche da quel punto
  var saveMap = {used: true};
  function save(){
    if (saveMap.used == true) saveMap = {used: false, map: createMap()};
  }
  function lunchCatchChange(){
    // Passo il salvataggio della mappa a catchChange così si può posiszionare il cursore nella pos vecchia col revert
    saveMap.used = true;
    catchChange(navigateMap(saveMap.map.start).node, saveMap.map);
  }

  editor.on('BeforeExecCommand', function (){ save(); });
  editor.on('keydown', function(e) { save(); });

  // Dopo che è avvenuto il cambiamento mando la ricerca per catturarlo e salvarlo
  editor.on('ExecCommand', function(e) {
    //console.log("Event:", e);
    if (e.command == "Undo") revertChange("UNDO");
    else if (e.command == "Redo") revertChange("REDO");
    else lunchCatchChange();
  });
  editor.on('keyup', function(e) {
    //console.log("Event:", e);
    lunchCatchChange();
  });

  // Da eliminare più avanti
  // Funzione di download/upload per capire la dimensione di mech e dello stato
  editor.ui.registry.addButton('lightly-Download', {
    text: 'Download',
    icon: 'action-next',
    onAction: function () {download(editor);}
  });
  editor.ui.registry.addButton('lightly-Upload', {
    text: 'Upload',
    icon: 'action-prev',
    onAction: function () {upload(editor);}
  });

  return { getMetadata: function () { return  { name: "lightly" }; }};
});

// Funzioni di supporto

//function sanitizeID(value){ return "0".repeat( sanitizeNum(5-value.toString().length, 5) ) + value; }
function getTime (){ return (new Date().toJSON()); }
function compareTime (oldTime, newTime, interval) { // torna true se oldTime è dentro il interval di newTime
  var tmp = new Date(oldTime);
  tmp.setSeconds(tmp.getSeconds() + interval);
  return tmp.toJSON() >= newTime;
}
// Mette num tra 0 e max
function sanitizeNum(num, max){ if(num<0){num = 0;} else if(num>max){num = max;} return num; }

// Ottieni i nodi principali
function isMainNode(node){ return(Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(node) || node == ed); }
function goToMainNode(node){ while ( !isMainNode(node) ) { node = node.parentNode; } return node; }

// Si muovono sull'albero di body
function stepBackNode(node) {
  if (ed == node) return node;
  else if (node.previousSibling != undefined) node = node.previousSibling;
  else node = stepBackNode(node.parentNode);
  return node;
}
function stepNextNode(node) {
  if (ed == node) return node;
  else if (node.nextSibling != undefined) node = node.nextSibling;
  else node = stepNextNode(node.parentNode);
  return node;
}

// Funzioni su carico/scarico dello stato
function catchState() { return(ed.innerHTML); }
function loadState(state) { ed.innerHTML = state; oldState = state; }

// Ottieni il range dela selezione
// Rimossa l'opzione del clone
function range() { return tinyMCE.activeEditor.selection.getRng(); }

// Per il log
function cutString(str, size) { if (str.length > size + 3){str = str.slice(0,size/2) + "..." + str.slice(str.length-(size/2), str.length);} return str; }

// Muovo pendo il primo elemento dell'array from e lo metto in fondo a to
// Serve per lo scambio di elemento dei 2 array dentro struct
function pop_move(from, to){
  var item = from.splice(from.length-1,1)[0];
  to[to.length] = item;
  return item;
}

// Da eliminare in deploy
function download(editor) {
  editor.windowManager.open({
    title: 'Download State',
    body: {
      type: 'panel',
      items: [{ type: 'input', name: 'title', label: 'Title'}]
    },
    buttons: [
      { type: 'cancel', text: 'Close' },
      { type: 'submit', text: 'Download', primary: true }
    ],
    onSubmit: function (api) {
      var data = api.getData();
      var title = data.title;
      function dw(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
      var state = catchState();
      dw(`UndoPlugin-${title}-state.txt`, state);
      dw(`UndoPlugin-${title}-struct.txt`, JSON.stringify(struct));
      dw(`UndoPlugin-${title}-all.txt`, JSON.stringify({state: state, struct: {edit: struct.editStruct, stack: struct.stackStruct, rev: struct.revertedStruct}}));
      if (log) console.log("File Downloaded");
      api.close();
    }
  });
}
function upload(editor) {
  var element = document.createElement('input');
  element.setAttribute('type', 'file');
  element.setAttribute('id', 'fileElem');
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  element.addEventListener("change", function () {
    var file = document.getElementById("fileElem").files;
    var fr = new FileReader();
    fr.onload = function(event) {
      var obj = JSON.parse(event.target.result);
      loadState(obj.state);
      struct.editStruct = obj.struct.edit;
      struct.stackStruct = obj.struct.stack;
      struct.revertedStruct = obj.struct.rev;
      if (log) console.log("File Uploaded");
      document.body.removeChild(element);
    };
    fr.readAsText(file[0]);
  }, false);
}
