"use strict";
const ipc = require('electron').ipcRenderer
const {webFrame} = require('electron');

// helpers:
function $(selector,container) {
    return (container || document).querySelector(selector);
}

// Note: Only clones 2D arrays
function cloneArray(arr) {
    return arr.slice().map(function(row) { return row.slice(); });  
}

function PopMessage() {
	var timer;
    var prevType='none';
    var prevMsg='';

    function show(msg,type)
    {
        var poparr = ['.info','.success','.warning'];    
        poparr.forEach(function(item) {
            if (item==type) {
                $(item).style.display='inline-block';
                $(item).innerHTML=msg;
            }
            else
                $(item).style.display='none';
        });                
    }

    this.show = function(msg,type,timeout,callback) {
            
        if (!!timer)
            clearTimeout(timer);   
        
        show(msg,type);
                
        if (timeout)
        {
            if (callback)
            {
                timer = setTimeout(callback,timeout);
            }
            else
            {
                timer = setTimeout(function() {
                    show(prevMsg,prevType)},timeout);  
                return;                                  
            }
        }
        prevType=type;
        prevMsg=msg;
    }

}

var createRingBuffer = function(cap) {
    var validItems=0, first=0, last=0;
    var capacity = cap;
    var buffer=[];

    return {
        isEmpty : function() {
            return first==last;
        },
        push : function(item) {
            last = (last + 1) % capacity;
            if (last==first)            
                first = (first+1) % capacity;
            buffer[last]=item;
        },
        pop : function() {
            if (this.isEmpty())
                return undefined;
            var item = buffer[last];
            last = last - 1;
            if (last<0)
                last = capacity-1;
            return item;
        },
        peek: function() {
            return this.isEmpty()?undefined:buffer[last];
        },
        clear: function() {
            last=first;
        },   
        findEqualBack(it) {
            var i=last;
            var n=0;
            while(i!=first) {
                n++;                
                if (buffer[i].isEqual(it)) 
                    return n;
                i = (i>0)?i-1:capacity-1;               
            }
            return 0;
        },      
        toString: function() {
            var i = first; 
            var str = "";
            if (this.isEmpty())
                return 'empty';
            while (i!=last) {
                i = (i+1) % capacity;
                str += ' '+ buffer[i] + ','
            }
            return str;    
        }
    }

}

function BoardSnap(board,step) {
    var _step;
    var _board;
    var alive;   
    var hash; 

    _step = step;
    _board = board;

    alive = calcAlive();
    hash = alive;

    function calcAlive() {
        let w = _board[0].length;
        let h = _board.length;
        var sum = 0;
        for (var y=0; y<h; y++) 
        {
            for (var x=0; x<w; x++)
            {
                if (board[y][x])
                    sum++;
            }
        }
        return sum;
    }

    this.isEqual = function(other) {
        if (hash!=other.getHash())
            return false;
        var otherBoard = other.getBoard();
        if (_board.length != otherBoard.length)
            return false;
        if (_board[0].length != otherBoard[0].length)
            return false;
        let w = _board[0].length;
        let h = _board.length;
        for (var y=0; y<h; y++) {
            for (var x=0; x<w; x++) {
                if (board[y][x] != otherBoard[y][x]) 
                    return false;                
            }
        }
        return true;
    }

    this.getBoard = function() {
        return _board;
    }
    this.getStep = function() {
        return _step;
    }
    this.getAlive = function() {
        return alive;
    }
    this.getHash = function() {
        return hash;
    }
} 

function GameLogic() {

	var num_alive=0;

	function width(board) {
		return !!board[0]?board[0].length:0;
	}

	function height(board) {
		return board?board.length:0;
	}

	function calcNumAlive(board) {
		num_alive=0;
		let w = width(board);
		let h = height(board);
		for (var y=0; y<h; y++) 
		{
			for (var x=0; x<w; x++)
			{
				var alive = !!board[y][x];
				if (alive)
					num_alive++;
			}
		}
	}

	function aliveNeighbors(array,x,y)
	{
		var prevRow = array[y-1] || [];
		var nextRow = array[y+1] || [];
		var currRow = array[y];
		var na = [
		prevRow[x-1],prevRow[x],prevRow[x+1],
		currRow[x-1],currRow[x+1],
		nextRow[x-1],nextRow[x],nextRow[x+1]                
		];

		return na.reduce(function(prev,cur) {
			return prev + !!cur;
		},0);           
	}

	this.next = function(board) {
		var w = width(board);
		var h = height(board);
		var nextBoard=[];
		num_alive=0;
		for (var y=0; y<h; y++) {
            nextBoard[y]=[];
			for (var x=0; x<w; x++) {
				var neighbors = aliveNeighbors(board,x,y)                     
				var alive = !!board[y][x]
				if (alive) {
					nextBoard[y][x]=1;
					if (neighbors<2 || neighbors>3) {
						nextBoard[y][x]=0;
					}
					else
						num_alive++;					
				}		
				else {
					if (neighbors==3) {
						nextBoard[y][x]=1;
						num_alive++;
					}   
					else
						nextBoard[y][x]=0;					
				}
			}
		}
		return nextBoard;	
	}	

	this.getNumAlive = function() {
		return num_alive;
	}

	this.calcNumAlive = function(board) {
		num_alive=0;
		let w = width(board);
		let h = height(board);
		for (var y=0; y<h; y++) 
		{
			for (var x=0; x<w; x++)
			{
				var alive = !!board[y][x];
				if (alive)
					num_alive++;
			}
		}
		return num_alive;
	}

}

function GameView() {
	var game = new GameLogic();
    var popMsg = new PopMessage();    
	var checkboxes=[];
	var gridSize = $('#grid_size').value;
	var auto_play = false;
	var currGen=0;
    var isDirty=true;
    var currBoard=[];
    createGrid(gridSize);
    setInfo(0,currGen);
    var timer=0;
    var nextSnap=0;
    var boardStack = createRingBuffer(1000);

    function stdMessage() {
        popMsg.show('Create by clicking on the grid or load from a file','.info');
    }

    popMsg.show('Welcome to the Game of Life','.info', 2000, stdMessage);

    $('#runbtn').addEventListener('click',function(e) {
        onRun();            
    });

    $('#stepbtn').addEventListener('click',function(e) {
        stopAutoRun();
        onNext();
    });

    $('#backbtn').addEventListener('click',function(e) {
        stopAutoRun();
        onBack();
    });

    $('#clearbtn').addEventListener('click',function() {
        stopAutoRun();        
        onClear();
        stdMessage();
    });

    $('#grid_size').addEventListener('change',function(){
        let val = $('#grid_size').value; 
        if (val!=gridSize)           
            onSizeChange(val);
    });

    $('#grid').addEventListener('change',function(evt) {        
        if (evt.target.nodeName.toLowerCase()=='input') {
            isDirty=true;
            stopAutoRun(); 
            nextSnap=0;
        }
    });

    ipc.on('saved-file', function (event, path) {
        if (path) {
            console.log('Path to save: ',path);
            saveToFile(path);
        }
    })
    
    function saveToFile(path) {
        var fs = require('fs');
        var arr = JSON.stringify(getBoard());
        fs.writeFile(path, arr, function(err) {
            if(err) {
                popMsg.show('Error '+err,'.warning',5000);
                return console.log(err);
            }
            popMsg.show(path+' written OK','.success',3000);
            console.log("The file was saved!");
        });             
    }

    ipc.on('selected-file', function (event, path) {
        if (path && path.length==1) {
            console.log('Path to load: ',path[0]);
            loadFromFile(path[0]);
        }
    })

    function loadFromFile(path) {
        var fs = require('fs');        
        fs.readFile(path,'utf8',function(err,data) {
            if (err) {
                popMsg.show('Read error: '+err,'.warning',5000);
                return console.log(err);                    
            }
            var arr = JSON.parse(data);
            if (!arr)
            {
                popMsg.show('Read error: '+err,'.warning',5000);
                return console.log(err);                                        
            }
            currBoard = arr;
            isDirty=false;
            onSizeChange(arr.length);
            currGen=0;
            setInfo(0,currGen);
            nextSnap=0;
            boardStack.clear();
            $('#grid_size').value=arr.length;
            popMsg.show(path+' loaded OK','.success',3000);
        })
    }

    function findMinRect(table) {
        var size = table.length;
        var xmin=size-1;
        var ymin=size-1;
        var xmax=0;
        var ymax=0;
        for (var y=0; y<size; y++)
        {
            for (var x=0; x<size; x++)
            {
                if (table[y][x]) 
                {
                    xmin = (x<xmin)?x:xmin;
                    ymin = (y<ymin)?y:ymin;

                    xmax = (x>xmax)?x:xmax;
                    ymax = (y>ymax)?y:ymax;
                }                    
            }
        }
        if (ymax<ymin || xmax<xmin)
            return [0,0,0,0];
        return [xmin,ymin,xmax,ymax];
    }

    function stopAutoRun()
    {
        auto_play=false;
        if (timer)
            clearTimeout(timer);
        timer=0;
        $('#runbtn').innerHTML='Run';
    }

    function getCompactTable(table) {
        var minrect = findMinRect(table);
        var x0 = minrect[0];
        var x1 = minrect[2];
        var y0 = minrect[1];
        var y1 = minrect[3];
        var minsizeX = x1 - x0 + 1;
        var minsizeY = y1 - y0 + 1;
        var size = Math.max(minsizeX,minsizeY);
        var res=[];
        for (let y=y0; y<=y1; y++)
        {
            res[y-y0]=[];
            for (let x=x0; x<=x1; x++)
            {
                res[y-y0][x-x0]=table[y][x];
            }
        }
        return res;
    }

    function onSizeChange(val) {
        if (val<6 || val>100) {
            $('#grid_size').value=gridSize;
            popMsg.show('Invalid size: must be >5 and <101','.warning',3000);            
            return;
        }
        var comptab = getCompactTable(getBoard());
        var compsizeY = comptab.length;
        var compsizeX = comptab[0].length;
        var x0 = Math.floor((val - compsizeX)/2);
        var x1 = x0+compsizeX;
        var y0 = Math.floor((val - compsizeY)/2);
        var y1 = y0+compsizeY;

        createGrid(val);
        for(let y = 0; y < val; y++) {
            for(let x = 0; x < val; x++) {
                if (x>=x0 && x<x1 && y>=y0 && y<y1) {                   
                    checkboxes[y][x].checked=!!comptab[y-y0][x-x0];
                }
                else
                    checkboxes[y][x].checked=false;
            }
        }
        gridSize=val;
        isDirty=true;
    }

	function createGrid(size) {
        var fragment = document.createDocumentFragment();
        var grid = $('#grid');
        grid.innerHTML = '';
        checkboxes = [];
        for (var y=0; y<size; y++) {
            var row = document.createElement('tr');
            checkboxes[y] = [];
            for (var x=0; x<size; x++) {
                var cell = document.createElement('td')                 
                var chk = document.createElement('input')
                chk.type='checkbox'
                checkboxes[y][x] = chk;
                chk.coords = [x,y];
                cell.appendChild(chk)
                row.appendChild(cell);
            }
            fragment.appendChild(row);
        }       
		grid.appendChild(fragment)
	}

    function getBoard() {
        if (isDirty) {
            currBoard = checkboxes.map(function (row) {
                return row.map(function (chkb) {
                    return +chkb.checked;
                });
            });
            isDirty=false;
        }
        return currBoard;
    }

    function updateGrid(board) {
        var size = gridSize;
        for(let y = 0; y < size; y++) {
            for(let x=0; x < size; x++) {
                checkboxes[y][x].checked = !!board[y][x];
            }
        }
    }

    function setInfo(alive,gen) {
        $('#numAlive').innerHTML = alive;
        $('#currGen').innerHTML = gen;        
    }

    function isEmpty(board) {
        var w = board[0].length;
        var h = board.length;
        for(let y = 0; y < w; y++) 
        {
            for(let x=0; x < h; x++) 
            {
                if (board[y][x])
                    return false;
            }
        }
        return true;
    }

    function onNext() {
        var b = getBoard();
        if (isEmpty(b)) {
            stopAutoRun();
            popMsg.show('Board is empty','.warning',3000,stdMessage);  
            return;          
        }

        if (boardStack.isEmpty()) {
            boardStack.push(new BoardSnap(b,0));            
        }
        else {
            if (nextSnap)
                boardStack.push(nextSnap);            
            else                
                boardStack.push(new BoardSnap(b,0));            
        }

        nextSnap=0;
        currBoard = game.next(b);
        updateGrid(currBoard);
        currGen++;
        var num_alive = game.getNumAlive();
        setInfo(num_alive,currGen);
        if (num_alive==0)
        {
            stopAutoRun();
            popMsg.show('Game over: all cells are dead','.info');
            return;
        }

        nextSnap = new BoardSnap(currBoard,currGen);
        var nperiod = boardStack.findEqualBack(nextSnap);
        if (nperiod>0) {
            stopAutoRun();
            if (nperiod==1)
                popMsg.show('Game over: static pattern (still life)','.info');            
            else    
                popMsg.show('Game over: static pattern - period of '+nperiod+' generations detected','.info');            
        }
    }

    function onBack() {
        if (boardStack.isEmpty())
        {
            console.log('board stack is empty!');
            return;
        }
        var nb = boardStack.pop();
        currBoard = nb.getBoard();
        if (currBoard.length==gridSize)
            updateGrid(currBoard);
        else
            onSizeChange(currBoard.length);                
        currGen = nb.getStep();
        nextSnap=0;
        setInfo(nb.getAlive(),currGen);        
    }

    function onRun() {
        if ($('#runbtn').innerHTML=='Run') {
            $('#runbtn').innerHTML='Stop'; 
            auto_play=true; 
            popMsg.show("Running..",".info");          
        }
        else {
            stopAutoRun();
            popMsg.show("Stopped.",".info");               
            return;            
        }
    
        (function autoPlay() {
            if (!auto_play)
            {
                clearTimeout(timer);
                return;
            }
            onNext();
            timer = setTimeout(autoPlay,500);
        })();
    }

    function onClear() {        
        currGen = 0;
        boardStack.clear();
        currBoard = getBoard();
        var size = gridSize;
        for(let y = 0; y < size; y++) {
            for(let x=0; x < size; x++) {
                currBoard[y][x] = 0;
            }
        }
        updateGrid(currBoard);    
        setInfo(0,currGen);
    }
}

var gameView = new GameView();
