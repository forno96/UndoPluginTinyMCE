function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';
  for (var i = 5; i > tmp; i--) {ret += '0';}
  return ret + value;
}
function getTime(){ return (new Date().toJSON());}

/*
INS, DEL
*/
class Mechanical {
  constructor(){
    this.editMech = 0;
    this.stackMech = [];
  }

  insItem(op, pos, content, by){
    this.stackMech.push({
      "id": "mech-" + sanitizeID(this.editMech),
      "op": op,
      "pos": pos,
      "content": content,
      "by": by,
      "timestamp": getTime(),
    });

    this.editMech++;
    return (this.editMech -1);
  }

  get stack() { return(this.stackMech); }

  remItem(i) { return(this.stackMech.splice(i,1)[0]);}
}

/*
NOOP, WRAP/UNWRAP, JOIN/SPLIT, REPLACE, INSERT/DELETE,
PUNTUATION, WORDREPLACE, WORDCHANGE, TEXTREPLACE
*/
class Structular {
  constructor(){
    this.stackStruct = [];
    this.editStruct = 0;
  }

  insItem(op, by, mech, listMech, old, nw){
    var item = {
      "id": "struct-" + sanitizeID(this.editStruct),
      "op": op,
      "old": old,
      "new": nw,
      "by": by,
      "timestamp": getTime(),
      "items": []
    };

    listMech.forEach((i) => {
      item.items.push(mech.retItem(i));
    });

    this.stackStruct.push(item);

    this.editStruct++;
    return (this.editStruct -1);
  }

  get stack(){ return(this.stackStruct);}
  retItem(i) {return(this.stackStruct[i]);}
}

/*
MEANING, FIX, STYLE, EDITCHAIN, EDITWAR, EDITWAKE
*/
class Semantic {
  constructor(){
    this.stackSem = [];
    this.editSem = 0;
  }

  insItem(op, by, struct, listStruct, old, nw){

    var item = {
      "id": "sem-" + sanitizeID(this.editSem),
      "op": op,
      "old": old,
      "new": nw,
      "items": []
    };

    listStruct.forEach((i) => {
      item.items.push(struct.retItem(i));
    });

    this.stackSem.push(item);

    this.editSem++;
    return (this.editSem -1)
  }

  get stack(){ return(this.stackSem);}
}

/* ----- */
// INIT CLASS and VAR
oldState = undefined;
var by = "Francesco";
var mech = new Mechanical();
//var struct = new Structular();
//var sem = new Semantic();

const delay = ms => new Promise(res => setTimeout(res, ms));

async function checkChange(){
  await delay(300);   // Per dare il tempo a tinyMCE di caricarsi
  while (true) {
    catchChange();
    await delay(700); // Ogni quanto va rilanciata
  }
}

function catchState(){
  state = tinyMCE.activeEditor.iframeElement.contentDocument.getElementsByTagName('body')[0].innerHTML;
  return(state)
}

function loadState(state){
  oldState = tinyMCE.activeEditor.iframeElement.contentDocument.getElementsByTagName('body')[0].innerHTML = state;
}

function catchChange(){
  newState = catchState();

  if (oldState == undefined) {
    oldState = newState;
    console.log(`State Loaded     |  ${oldState}`);
    return (false);
  }

  var start = 0;
  var newEnd = newState.length -1;
  var oldEnd = oldState.length -1;
  while (start < newState.length && newState[start] == oldState[start]) start ++;
  //console.log(start,newState[start],oldState[start])
  while (newEnd > start && newState[newEnd] == oldState[oldEnd]) {// se old < new
    newEnd --;
    oldEnd --;
  }

  //console.log(newEnd,newState[newEnd],oldEnd,oldState[oldEnd])

  if (start < newState.length) { // Se c'è stato un cambiamento
    console.log(`State Changed    |  ${newState}`);
    mech.insItem("DEL", start, oldState.slice(start,oldEnd+1), by);
    mech.insItem("INS", start, newState.slice(start,newEnd+1), by);
  }
  else console.log(`State Unchanged  |  ${oldState}`);

  oldState = newState;
}

function revertChange() {
  if (mech.stack.length == 0) return (false); // Se la pila è vuota revert non deve fare nulla

  state = catchState();

  for (var i = 0; i < 2; i++) {
    item = mech.remItem(mech.stackMech.length-1);
    //console.log(item);
    if (item.op == "INS") {
      state = state.slice(0,item.pos) + state.slice(item.pos + item.content.length);
    }
    else { // se op è DEL
      state = state.slice(0,item.pos) + item.content + state.slice(item.pos);
    }
  }

  loadState(state);
}

function test(){
  var by = "Francesco";

  var mech = new Mechanical();
  var struct = new Structular();
  var sem = new Semantic();

  mech.insItem("DEL", 2343, "nuovo", by);
  mech.insItem("DEL", 446, "</p><p>", by);

  struct.insItem("NOOP", by, mech, [0,1]);

  sem.insItem("MEANING", by, struct, [0]);

  return sem.stack;
}


tinymce.PluginManager.add('example', function(editor, url) {
  // Add a button that opens a window
  editor.ui.registry.addButton('example', {
    text: 'Revert',
    onAction: function () {
      revertChange();
    }
  });

  return {
    getMetadata: function () {
      return  {
        name: "Undo stack plugin",
        url: "http://exampleplugindocsurl.com"
      };
    }
  };
});
