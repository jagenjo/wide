//WIDE.js Coded by Javi Agenjo (@tamat) 2018
"use strict"

//main class
var WIDE = {
	commands: {},
	files: [],
	files_by_name: {},
	current_file: null,
	visible_file: null,
	current_folder: ".",
	extensions_to_language: { "js":"javascript" },
    key: "",
	buttons: [],
    server_url: "server.php", //change it if it is hosted in a different folder that the index.html

	init: function()
	{
		this.editor_container = document.getElementById('code-editor');

		require.config({ paths: { 'vs': 'js/monaco-editor/min/vs' }});
		require(['vs/editor/editor.main'], function(){
			WIDE.onReady();
		});

        this.editor_header = document.querySelector("#code-header");        

		var input = this.console_input = document.querySelector("#bottom input");
		input.addEventListener("keydown",function(e){
			if(e.keyCode == 13)
			{
				WIDE.onCommand( this.value );
				this.value = "";
				return;
			}
		});

		document.addEventListener("keydown", this.onKey.bind(this) );

		window.onresize = function()
		{
			for(var i = 0; i < WIDE.files.length; ++i)
				if(WIDE.files[i].editor)
					WIDE.files[i].editor.layout();
		}

        window.onbeforeunload = function()
        {
            WIDE.saveSession();
            if(!WIDE.checkAllFilesSaved())
                return "Not all files are saved";
        }

		var container = document.querySelector("#sidebar .header");
		for(var i in this.buttons)
		{
			var b = this.buttons[i];
			var element = document.createElement("button");
			if(b.icon)
				element.innerHTML = '<svg class="icon"><use xlink:href="#si-'+b.icon+'"/></svg>';
			else
				element.innerHTML = b.name;
			if(b.className)
				element.className = b.className;
			element.setAttribute("title",b.name);
			element.dataset["command"] = b.command;
			element.addEventListener("click",function(e){ WIDE.onCommand( this.dataset["command"] ); });
			container.appendChild(element);
		}
	},

    onReady: function()
    {
        WIDE.reset();
        WIDE.loadSession();
    },

	showCodeEditor: function( file_info, force_assign )
	{
		if(!file_info)
			return null;

		if(file_info.editor)
		{
			if(this.visible_file != file_info)
			{
				if(	this.visible_file )
					this.visible_file.editor_element.style.display = "none";
			}
			file_info.editor_element.style.display = "";
			this.visible_file = file_info;
			if(force_assign)
				file_info.editor.setValue(file_info.content);
			file_info.editor.layout();
			return file_info.editor;
		}

		var editor_element = document.createElement("div");
		editor_element.classList.add("editor-wrapper");
		this.editor_container.appendChild( editor_element );
		file_info.editor_element = editor_element;

		//a model is a file content
		var model = monaco.editor.createModel("", "javascript");
		file_info.model = model;

		//an editor is a view of a model
		var editor = monaco.editor.create( editor_element, {
			value: "",
			model: model,
			language: 'javascript',
			theme: 'vs-dark'
		});
		file_info.editor = editor;
		editor.file_info = file_info;

		setTimeout(function(){ editor.layout(); }, 1000);
		editor.onDidType( function(e){
			WIDE.onContentChange( file_info );
		});
		editor.onContextMenu(function(e){
			console.log("context",e);
		});
		editor.onKeyDown( function(e){
			WIDE.onEditorKey(e);
		});

		/*
		editor.addCommand(monaco.KeyCode.Escape, function() {
			console.log('my command is executing!');
		});
		*/

		if(	this.visible_file && this.visible_file != file_info )
			this.visible_file.editor_element.style.display = "none";
		this.visible_file = file_info;

		editor.setValue( file_info.content || "" );

        if( file_info.cursor )
            editor.setPosition( file_info.cursor );
		if( file_info.scrollTop )
			editor.setScrollTop( file_info.scrollTop );
		return editor;
	},

	load: function( filename, callback, open )
	{
		var file_info = this.onFileAdded( filename );

		var form = new FormData();
		form.append("action","load");
		form.append("filename",filename);
        form.append("key", this.key );

		var headers = new Headers();
		headers.append('pragma', 'no-cache');
	 	headers.append('cache-control', 'no-cache');

		var info = { method: 'POST',  body: form, headers: headers };

		fetch( this.server_url, info).then(function(resp){
			return resp.text();
		}).then( function(data){
			var r = JSON.parse(data);
			if(r.status == 1)
			{
				if(r.is_binary)
					console.error("binary file");
				else
					WIDE.onFileLoaded( filename, r.content );
			}
			else
			{
				WIDE.close( filename );
				console.error( r.msg );
				return;
			}
			if(callback)
				callback(r);
			if( open )
				WIDE.open( filename );
		});

        return file_info;
	},

	save: function()
	{
		if(!WIDE.current_file)
			return;

		var file_info = WIDE.current_file;
		file_info.content = file_info.editor.getValue();

		var filename = WIDE.current_file.name;
		var content = WIDE.current_file.content;

		var form = new FormData();
		form.append("action","save");
		form.append("filename",filename);
		form.append("content",content);
        form.append("key", this.key );
		var info = { method: 'POST', body: form };

        this.editor_header.classList.add("saving");

		fetch( this.server_url , info ).then(function(resp){
			return resp.text(); 
		}).then( function(data){
            WIDE.editor_header.classList.remove("saving");
			var r = JSON.parse(data);
			if(r.status == 1)
                WIDE.onFileSaved( filename );
			else
				console.error( r.msg );
		});
	},

	"delete": function( filename )
	{
		if(!filename)
			return;

		var file_info = WIDE.files_by_name[filename];
		if(!file_info)
			return;
		if(file_info._exist === false)
		{
			this.close( filename );
			return;
		}

		var form = new FormData();
		form.append("action","delete");
		form.append("filename",filename);
        form.append("key", this.key );
		var info = { method: 'POST', body: form };

		fetch( this.server_url, info ).then(function(resp){
			return resp.text();
		}).then( function(data){
			var r = JSON.parse(data);
			if(r.status == 1)
			{
				console.log(r.msg);
                WIDE.close( filename );
			}
			else
				console.error( r.msg );
		});
	},

	open: function( filename )
	{
        if(!filename)
            return; 
        if( this.current_file && this.current_file.name == filename )
            return;
        this.onVisibleFileChange();
		var file_info = this.files_by_name[ filename ];
		if(!file_info || file_info.content === null)
		{
			this.load( filename, null, true );
			return;
		}
		this.current_file = file_info;
		this.showCodeEditor( file_info );

		/*
		this.editor.setValue( file_info.content );
        if( file_info.cursor )
            this.editor.setPosition( file_info.cursor );
		this.editor.setScrollTop( file_info.scrollTop || 0);
		*/

		file_info.file_element.classList.add("selected");
		this.editor_header.innerHTML = "<span class='filename'>" + file_info.name + "</span><span class='close'>&#10005;</span>";
		this.editor_header.querySelector(".close").addEventListener("click",function(e){
			WIDE.close();
		});

        var index = filename.lastIndexOf(".");
        var ext = "text";
        if(index != -1)
            ext = filename.substr(index+1).toLowerCase();
		if( this.extensions_to_language[ext] )
			ext = this.extensions_to_language[ext];
        monaco.editor.setModelLanguage( file_info.model, ext );
        
		file_info.editor.focus();
	},

    close: function( filename )
    {
        var is_current = this.current_file && this.current_file.name == filename;
        if(!filename)
            filename = this.current_file ? this.current_file.name : null;
        if(!filename)
            return;
        var file_info = this.files_by_name[ filename ];
        if(!file_info)
            return;
		if(file_info.editor_element) //bin files do not have editor
			file_info.editor_element.parentNode.removeChild( file_info.editor_element );
        file_info.file_element.parentNode.removeChild( file_info.file_element );
        var entries = document.querySelectorAll("#open-files .filename .number");
        for(var i = 0; i < entries.length && i < 10; ++i)
            entries[i].innerHTML = i+1;
        var index = this.files.indexOf( file_info );
        if(index != -1)
            this.files.splice( index, 1 );
        delete this.files_by_name[ filename ];
        if(!is_current)
            return;
        var next_file = this.files[ index < this.files.length ? index : this.files.length - 1 ];
        if(!next_file)
		{
            this.current_file = null;
			var header = document.querySelector("#code-header");
			header.innerHTML = "";
		}
        else
            this.open(next_file.name);
    },

	create: function( filename, content, open )
	{
		if(!filename)
			filename = prompt("Choose file name");
		if(!filename)
			return;
        if( this.current_file && this.current_file.name == filename )
            return;
        this.onVisibleFileChange();
        var file_info = this.onFileAdded( filename, content || "" );
        file_info.file_element.classList.add("modifyed");
        file_info._exist = false;
        if(open)
            this.open(filename);
		return file_info;
	},

    reset: function()
    {
        this.files = [];
        this.files_by_name = {};
        this.current_file = null;
		document.querySelector("#open-files").innerHTML = "";

        //this.editor.setValue("");
    },

	list: function( folder )
	{
		folder = folder || this.current_folder;
		queryforEach("#sidebar .header button",function(a){ a.classList.remove("selected"); });
		document.querySelector(".list-files-button").classList.add("selected");
		document.querySelector("#open-files").style.display = "none";
		var container = document.querySelector("#folder-files");
		container.style.display = "block";
		container.classList.add("loading");
		//container.innerHTML = "loading...";
		var form = new FormData();
		form.append("action","list");
		form.append("folder", folder );
        form.append("key", this.key );
		var info = { method: 'POST', body: form };

		fetch( this.server_url, info ).then(function(resp){
			return resp.text();
		}).then( function(data){
			var r = JSON.parse(data);
			if(r.status == 1)
                WIDE.onShowFolderFiles( r.folder, r.files, r.project );
			else
				console.error( r.msg );
		});
	},

    serialize: function()
    {
		if(this.current_file)
		{
			this.current_file.cursor = this.current_file.editor.getPosition();
			this.current_file.scrollTop = this.current_file.editor.getScrollTop();
		}

        var o = { 
			key: this.key, 
			files: [],
			current_folder: this.current_folder
		};
        for(var i = 0; i < this.files.length; ++i)
        {
            var file_info = this.files[i];
			if(!file_info.name)
				continue;
			var item = { name: file_info.name, cursor: file_info.cursor, scrollTop: file_info.scrollTop };
            if(file_info._exist === false)
				item.content = file_info.editor.getValue();
            o.files.push(item);
        }
        if(this.current_file)
            o.current = {
                name: this.current_file.name,
                cursor: this.current_file.editor.getPosition(),
				scrollTop: this.current_file.editor.getScrollTop()
            }
        return o;
    },

    configure: function(o)
    {
		if(o.key)
			this.key = o.key;
        else
            console.log("no key found in session, type: key YOURKEY");
        
		if(o.current_folder)
			this.current_folder = o.current_folder;

        if(o.files)
            for(var i = 0; i < o.files.length; ++i)
            {
                var file_data = o.files[i];
				var file_info;
				if( file_data.content )
					file_info = this.create( file_data.name, file_data.content );
				else
					file_info = this.load( file_data.name );
				for(var j in file_data)
					file_info[j] = file_data[j];
            }
        if(o.current)
        {
			var file_info = null;
            if(o.current.name)
			{
				if( o.current.content )
	                file_info = this.create( o.current.name, o.current.content );
				else
		            file_info = this.open(o.current.name);
			}
			if( file_info )
			{
				if(o.current.cursor)
					file_info.editor.setPosition( o.current.cursor );
				if(o.current.scrollTop)
					file_info.editor.setScrollTop( o.current.scrollTop );
			}
        }
		if(this.current_file && this.current_file.editor)
			this.current_file.editor.focus();
    },

    loadSession: function()
    {
        var session = localStorage.getItem("wide_session");
        if(!session)
        {
            console.log("no session found, type: key YOURKEY");
            return;
        }
        session = JSON.parse( session );
        this.configure(session);
    },

    saveSession: function()
    {
        localStorage.setItem("wide_session", JSON.stringify( WIDE.serialize() ));
    },
	
    checkAllFilesSaved: function()
    {
        for(var i = 0; i < this.files.length; ++i)
        {
            var file = this.files[i];
            if( file._exist === false || file.file_element.classList.contains("modifyed") )
               return false;
        }
        return true;
    },

	play: function()
	{
		console.log("evaluation code...");
		var code = this.current_file.editor.getValue();
		var func = new Function(code);
		func.call(window);
	},

    //events
	onCommand: function(cmd)
	{
		console.log(cmd);
		var t = cmd.split(" ");
		var func = this.commands[t[0]];
		if( !func )
		{
			console.error("command unknown: " + t[0]);
			return;
		}
		func( cmd, t );
	},

	onKey: function(e)
	{
		//console.log(e);
		if( e.code == "KeyS" && e.ctrlKey )
		{
			e.preventDefault();
			this.save();
		}
		if( e.code == "KeyP" && e.ctrlKey )
		{
			e.preventDefault();
			this.play();
		}
		if( e.keyCode >= 49 && e.keyCode <= 58 && e.altKey && e.ctrlKey )
        {
            var file_info = this.files[e.keyCode - 49];
            if(file_info)
                this.open( file_info.name );
        }
        //else if( e.keyCode == 27 )
        //    document.querySelector("#bottom input").focus();
	},

    onEditorKey: function(e)
    {
        //console.log("ed key",e);
    },

	onFileAdded: function( filename, content )
	{
		var file_info = this.files_by_name[ filename ];
		if(!file_info)
		{
			file_info = { name: filename, content: null };
			this.files.push( file_info );
			this.files_by_name[ filename ] = file_info;
		}

		if( content != null )
			file_info.content = content;

		if(!file_info.file_element)
		{
            var container = document.querySelector("#open-files");
			var t = filename.split("/");
			var basename = t[ t.length - 1 ] || ".";
			var element = document.createElement("div");
			element.className = "filename";
			if( file_info.content === null )
				element.className += " notloaded";
			element.innerHTML = "<span class='number'></span>"+basename+"<span class='close'>&#10005;</span>";
			container.appendChild(element);
			element.dataset["filename"] = filename;
			element.querySelector(".close").addEventListener("click", function(e){
				if( confirm("File not saved, are you sure you want to "+(e.shiftKey ? "delete" : "close")+" it?\nData will be lost." ) )
				{
					if(e.shiftKey)
						WIDE.delete( element.dataset["filename"] );
					else
						WIDE.close( element.dataset["filename"] );
				}
                e.stopImmediatePropagation();
                e.stopPropagation();
			});
			element.addEventListener("click", function(e){
				WIDE.open( this.dataset["filename"] );
			});
			file_info.file_element = element;
            var entries = container.querySelectorAll(".filename .number");
            for(var i = 0; i < entries.length && i < 10; ++i)
                entries[i].innerHTML = i+1;
		}

        return file_info;
	},

	onFileLoaded: function( filename, content )
	{
		var file_info = this.files_by_name[ filename ];
		if(!file_info)
            return; //a file arrives but is no longer in the editor

		if(!file_info.file_element)
			throw("file entry without element?");
		file_info.file_element.classList.remove("notloaded");
		file_info.content = content;
        	file_info._exist = true;
		if(this.current_file && this.current_file.name == filename)
			file_info.editor.setValue(content);
	},

	onShowFolderFiles: function( folder, files, project )
	{
		var container = document.querySelector("#folder-files");
		container.innerHTML = "<div class='project-title'>"+(project || "")+"</div>";
		container.classList.remove("loading");
		folder = this.cleanPath( folder );
		this.current_folder = folder;
		var tree = folder.split("/");
		var folders = [{ name: ".", is_dir: true, is_parent: true, fullpath: "." }];
		for( var i = 0; i < tree.length; ++i )
			folders.push({ name: tree[i], is_dir: true, is_parent: true, fullpath: tree.slice(0,i+1).join("/") });
		var files_and_folders = folders.concat( files );
		var folders = files_and_folders.filter(function(a){ return a.is_dir; });
		var files = files_and_folders.filter(function(a){ return !a.is_dir; });
		files_and_folders = folders.concat(files);

		for(var i = 0; i < files_and_folders.length; ++i)
		{
			var file = files_and_folders[i];
			if(!file.name)
				continue;
			var fullpath = this.cleanPath( file.fullpath || folder + "/" + file.name );
			var element = document.createElement("div");
			element.className = "filename";
			if( file.is_dir )
				element.classList.add("folder");
			if( file.is_parent )
				element.classList.add("parent-folder");
			element.innerHTML = '<svg class="icon"><use xlink:href="#si-bootstrap-'+(file.is_dir ? "folder-close":"file")+'" /></svg> ' + file.name;
			container.appendChild(element);
			var depth = fullpath.split("/").length;
			element.style.marginLeft = (depth * 5) + "px";
			element.dataset["is_dir"] = file.is_dir;
			element.dataset["filename"] = file.name;
			element.dataset["fullpath"] = fullpath;
			element.addEventListener("click", function(e){
				if( this.dataset["is_dir"] == "true" )
					WIDE.list( this.dataset["fullpath"] );
				else
				{
					WIDE.load( this.dataset["fullpath"], null, true );
					//container.style.display = "none";
					//document.querySelector("#open-files").style.display = "";
				}
			});
		}

		var element = document.createElement("div");
		element.className = "filename new-file";
		element.innerHTML = " + new file";
		element.addEventListener("click", function(e){
			element.innerHTML = "<input type='text' placeHolder='type filename'/>";
			var input = element.querySelector("input");
			input.addEventListener("keydown",function(e){
				if(e.keyCode != 13)
					return;
				e.preventDefault();
				var filename = this.value;
				if(filename)
				{
					WIDE.toggleFiles();
					WIDE.create(filename,"",true);
				}
				setTimeout(function(){ element.innerHTML = " + new file"; },1);
			});
			input.focus();
			input.addEventListener("blur", function(e){
				setTimeout(function(){ element.innerHTML = " + new file"; },1);
			});
		});
		container.appendChild( element );
	},

    onFileSaved: function( filename )
    {
		var file_info = this.files_by_name[ filename ];
		if(!file_info)
			throw("cannot call onFileSaved if there is no file entry");
        if(file_info.file_element)
            file_info.file_element.classList.remove("modifyed");
        file_info._exist = true;
    },

    onVisibleFileChange: function()
    {
		if(!this.current_file)
			return;
        var old = this.current_file.content;
		/*
        this.current_file.content = this.editor.getValue();
        this.current_file.cursor = this.editor.getPosition();
		this.current_file.scrollTop = this.editor.getScrollTop();
		*/

		this.current_file.file_element.classList.remove("selected");

        /*
        if(old != this.current_file.content)
            this.current_file.file_element.classList.add("modifyed");
        */
    },

	onContentChange: function(file_info)
	{
		if(!file_info)
			return;
		file_info.file_element.classList.add("modifyed");
        this.editor_header.classList.add("modifyed");
        //change title too?
	},

	cleanPath: function(path)
	{
		var t = path.split("/");
		t = t.filter( function(v) { if (v == ".") return false; return !!v; } );
		//apply "../", sometimes this gives me problems
		var result = [];
		for(var i = 0; i < t.length; i++)
		{
			if(t[i] == "..")
				result.pop();
			else
				result.push( t[i] );
		}

		return result.join("/");
	},

	toggleFiles: function()
	{
		document.querySelector("#open-files").style.display = "";
		document.querySelector("#folder-files").style.display = "none";
		queryforEach("#sidebar .header button",function(a){ a.classList.remove("selected"); });
		document.querySelector(".open-files-button").classList.add("selected");
	}
};


WIDE.commands.load = function( cmd, t ) { WIDE.load( t[1], null, true );} 
WIDE.commands.save = function( cmd, t ) { WIDE.save(); }
WIDE.commands.new = function( cmd, t ) { WIDE.create(t[1],"",true); }
WIDE.commands.delete = function( cmd, t ) { WIDE.delete(t[1]); }
WIDE.commands.close  = function( cmd, t ) { WIDE.close(t[1]); }
WIDE.commands.reset  = function( cmd, t ) { WIDE.reset(); }
WIDE.commands.play = function( cmd, t ) { WIDE.play(); }
WIDE.commands.list = function( cmd, t ) { WIDE.list(t[1]); }
WIDE.commands.files = function( cmd, t ) { WIDE.toggleFiles(); }
WIDE.commands.key = function( cmd, t ) { WIDE.key = t.slice(1).join(" "); }

WIDE.buttons.push({ name:"new", icon:"elusive-file-new", command: "new"});
WIDE.buttons.push({ name:"current files", className:'open-files-button selected', icon:"bootstrap-file", command: "files" });
WIDE.buttons.push({ name:"open file", className:'list-files-button', icon:"bootstrap-folder-open", command: "list" });
WIDE.buttons.push({ name:"save current", icon:"bootstrap-import", command: "save" });
WIDE.buttons.push({ name:"execute code", icon:"bootstrap-play", command: "play" });

//helpers
function queryforEach( selector,callback )
{
	var list = document.querySelectorAll(selector);
	for(var i = 0;i < list.length; ++i)
		callback( list[i] );
}

WIDE.init();

