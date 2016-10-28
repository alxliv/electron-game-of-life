"use strict";
const ipc = require('electron').ipcRenderer

// helper:
function $(selector,container) {
    return (container || document).querySelector(selector);
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
	var autoplay = false;
	var currGen=0;
    var isDirty=true;
    var currBoard=[];
    createGrid(gridSize);
    setInfo(0,currGen);
    var timer=0;

    popMsg.show('Welcome to the Game of Life','.info', 2000, function() {
        popMsg.show('Load from file or create by clicking on the grid','.info')        
    });

    $('#runbtn').addEventListener('click',function(e) {
        onRun();            
    });

    $('#stepbtn').addEventListener('click',function(e) {
        stopAutoRun();
        onNext();
    });

    $('#clearbtn').addEventListener('click',function() {
        stopAutoRun();        
        onClear();
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
        }
    });

    $('#savebtn').addEventListener('click',function(e) {
        ipc.send('save-dialog')
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

    $('#loadbtn').addEventListener('click',function(e) {
        stopAutoRun();        
        ipc.send('open-file-dialog');
    });
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

    function onNext() {
        currBoard = game.next(getBoard());
        updateGrid(currBoard);
        currGen++;
        setInfo(game.getNumAlive(),currGen);
    }

    function onRun() {
        if ($('#runbtn').innerHTML=='Run') {
            $('#runbtn').innerHTML='Stop';            
        }
        else {
            stopAutoRun();
            return;            
        }
    
        (function autoPlay() {
            onNext();
            timer = setTimeout(autoPlay,500);
        })();
    }

    function onClear() {        
        currGen = 0;
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
