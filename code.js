//WIDE.js Coded by Javi Agenjo (@tamat) 2018
"use strict"

//main class
var WIDE = {

    //config
    persistent_session: true, //set to false if you do not want the keys to be stored in localStorage
    server_url: "server.php", //change it if it is hosted in a different folder than the index.html

    //globals
	commands: {},
	files: [],
	files_by_name: {},
	current_file: null,
	visible_file: null,
	current_folder: ".",
	extensions_to_language: { "js":"javascript" },
    key: "",
	buttons: [],
    console_open: false,

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
                this.style.opacity = 1;
				this.value = "";
				return;
			}
			else if(e.keyCode == 27 && WIDE.visible_file) //ESC
			{
				WIDE.visible_file.editor.focus();
				e.preventDefault();
			}
            if(this.value.substr(0,4) == "key " || this.value.substr(0,8) == "tempkey ") //hide key
                this.style.opacity = 0;
            else
                this.style.opacity = 1;
		});

		document.addEventListener("keydown", this.onKey.bind(this), true );

		window.onresize = this.onResize.bind(this);
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
			element.addEventListener("click",function(e){ WIDE.onCommand( this.dataset["command"], true ); });
			container.appendChild(element);
		}

        this.console_element = document.querySelector("#console");
	},

    onResize: function()
    {
        for(var i = 0; i < this.files.length; ++i)
            if(this.files[i].editor)
                this.files[i].editor.layout();
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
			theme: 'vs-dark',
			folding: true
		});
		file_info.editor = editor;
		editor.file_info = file_info;

		setTimeout(function(){ editor.layout(); }, 1000);
		editor.onDidType( function(e){
			WIDE.onContentChange( file_info );
		});
		editor.onContextMenu(function(e){
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

        if(!this.key)
        {
            console.error("file cannot be loaded, no key set. Type 'key YOUKEY' in the command bar to have access to the server.");
            return;
        }

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

        if(!this.key)
        {
            console.error("file cannot be saved, no key set");
            return;
        }            

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
			var r = JSON.parse(data);
			if(r.status == 1)
            {
                WIDE.editor_header.classList.remove("saving");
                WIDE.onFileSaved( filename );
            }
			else
				console.error( r.msg );
		});
	},

	"delete": function( filename )
	{
		if(!filename)
			return;

        if(!this.key)
        {
            console.error("file cannot be deleted, no key set");
            return;
        }              

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

		file_info.file_element.classList.add("selected");
		var filename_pretty = filename.split("/").join("<span class='slash'>/</span>");
		this.editor_header.innerHTML = "<span class='filename'>" + filename_pretty + "</span><span class='close'>&#10005;</span>";
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
        document.querySelector("#code-editor").innerHTML = "";
    },

	list: function( folder )
	{
		folder = folder || this.current_folder;

		queryforEach("#sidebar .header button",function(a){ a.classList.remove("selected"); });
		document.querySelector(".list-files-button").classList.add("selected");
		document.querySelector("#open-files").style.display = "none";
		var container = document.querySelector("#folder-files");
		container.style.display = "block";

        if(!this.key)
        {
        	var container = document.querySelector("#folder-files");
            container.innerHTML = "<p>Cannot access server, no key found.</p><p>Type your key to have access to the server.</p><p><input placeHolder='type key' type='password'/></p>";
			container.querySelector("input").addEventListener("keydown",function(e){
				if(e.keyCode != 13)
					return;
				WIDE.setKey(this.value);	
			});
            return;
        }

		container.classList.add("loading");
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
			key: this.persistent_session ? this.key : null, 
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
				item.content = file_info.editor ? file_info.editor.getValue() : file_info.content;
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
        
		if(o.current_folder)
			this.current_folder = o.current_folder;

        if(o.files)
            for(var i = 0; i < o.files.length; ++i)
            {
                var file_data = o.files[i];
				var file_info;
				if( file_data.content != null )
					file_info = this.create( file_data.name, file_data.content );
				else 
					file_info = this.load( file_data.name );
				if(!file_info) //no key
					continue;
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

	execute: function()
	{
		console.log("evaluating code");
        console.log("--------------------------");
		var code = this.current_file.editor.getValue();
		var func = new Function(code);
		var r = func.call(window);
	},

	setKey: function( key, temporal )
	{
		this.key = key;
		WIDE.commands.clear();
		if(this.key)
			this.list();
		if(temporal)
			WIDE.persistent_session = false;
		console.log("key assigned");
	},

    //events
	onCommand: function( cmd, skip_console )
	{
        if(!skip_console)
		    console.log( "> " + cmd );
        if(cmd[0] == "=") //eval JS
        {
            var r = eval(cmd.substr(1));
            console.log(String(r));
            return;
        }
		var t = cmd.split(" ");
		var func = this.commands[t[0]];
		if( !func )
		{
			console.error("command unknown: " + t[0]);
			return;
		}
		var r = func( cmd, t );
        if(r && r.constructor === String)
            console.log(r);
	},

	onKey: function(e)
	{
		//console.log(e);
		if( e.code == "KeyS" && e.ctrlKey )
			this.save();
		else if( e.code == "KeyO" && e.ctrlKey )
			this.toggleConsole();
		else if( e.code == "KeyQ" && e.ctrlKey )
            document.querySelector("#bottom input").focus();
		else if( (e.code == "KeyP" || e.code == "Enter") && e.ctrlKey )
			this.execute();
		else if( e.keyCode >= 49 && e.keyCode <= 58 && e.altKey && e.ctrlKey )
        {
            var file_info = this.files[e.keyCode - 49];
            if(file_info)
                this.open( file_info.name );
        }
		else
			return true; //release the event so monaco can process it

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
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
                var is_saved = file_info._exist !== false;
				if( is_saved || confirm("File not saved, are you sure you want to "+(e.shiftKey ? "delete" : "close")+" it?\nData will be lost." ) )
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
		container.innerHTML = "<div class='project-title'>"+(project || "")+"<span class='close' title='remove key'>✕</span></div>";
		container.querySelector(".close").addEventListener("click",function(e){	WIDE.setKey(""); WIDE.list(); });
		container.classList.remove("loading");
		folder = this.cleanPath( folder );
		this.current_folder = folder;
		var tree = folder.split("/");
		var folders = [{ name: "root folder", is_dir: true, is_parent: true, fullpath: "." }];
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
			var icon = "bootstrap-file";
			if( file.is_dir ) 
				icon = "bootstrap-folder-close";
			if( file.is_parent ) 
				icon = "bootstrap-play";
			element.innerHTML = '<svg class="icon"><use xlink:href="#si-'+icon+'" /></svg> ' + file.name;
			container.appendChild(element);
			var depth = !fullpath ? 0 : fullpath.split("/").length;
			element.style.marginLeft = (depth * 5) + "px";
			element.dataset["is_dir"] = file.is_dir;
			element.dataset["filename"] = file.name;
			element.dataset["fullpath"] = fullpath || ".";
			var can_be_opened = true;
			if(file.mime_type)
			{
				element.dataset["mime_type"] = file.mime_type;
				var type = file.mime_type.split("/")[0].toLowerCase();
				can_be_opened = type != "image" && type != "audio" && type != "video";
				if(!can_be_opened)
					element.classList.add("blocked");
			}
			element.setAttribute("title",fullpath);
			if(can_be_opened)
				element.addEventListener("click", function(e){
					if( this.dataset["is_dir"] == "true" )
						WIDE.list( this.dataset["fullpath"] );
					else
						WIDE.load( this.dataset["fullpath"], null, true );
				});
		}

		//new file
		var new_file_text = '<svg class="icon"><use xlink:href="#si-elusive-file-new" /></svg> new file';
		var element = document.createElement("div");
		element.className = "filename new-file";
		element.innerHTML = new_file_text;
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
					WIDE.create( WIDE.cleanPath(folder + "/" + filename),"",true);
				}
				setTimeout(function(){ element.innerHTML = new_file_text; },1);
			});
			input.focus();
			input.addEventListener("blur", function(e){
				setTimeout(function(){ element.innerHTML = new_file_text; },1);
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
		this.current_file.file_element.classList.remove("selected");
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
	},

    toConsole: function( str, className )
    {
        var elem = document.createElement("div");
        elem.innerText = str;
        elem.className = "msg " + (className || "");
        this.console_element.appendChild(elem);
        if( this.console_element.childNodes.length > 1000)
            this.console_element.removeChild( this.console_element.childNodes[0] );
        this.console_element.scrollTop = 1000000;
    },

    toggleConsole: function()
    {
        this.console_open = !this.console_open;
        document.querySelector("#container").classList.toggle("show_console");
        this.onResize();
    }
};

//commands
WIDE.commands.load = function( cmd, t ) { WIDE.load( t[1], null, true );} 
WIDE.commands.save = function( cmd, t ) { WIDE.save(); }
WIDE.commands.new = function( cmd, t ) { WIDE.create(t[1],"",true); }
WIDE.commands.delete = function( cmd, t ) { WIDE.delete(t[1]); }
WIDE.commands.close  = function( cmd, t ) { WIDE.close(t[1]); }
WIDE.commands.reset  = function( cmd, t ) { WIDE.reset(); }
WIDE.commands.execute = function( cmd, t ) { WIDE.execute(); }
WIDE.commands.list = function( cmd, t ) { WIDE.list(t[1]); }
WIDE.commands.files = function( cmd, t ) { WIDE.toggleFiles(); }
WIDE.commands.reload = function( cmd, t ) { for(var i in WIDE.files) WIDE.load( WIDE.files[i].name ); }
WIDE.commands.key = function( cmd, t ) { WIDE.setKey(t.slice(1).join(" ")); }
WIDE.commands.tempkey = function( cmd, t ) { WIDE.setKey(t.slice(1).join(" "),false); }
WIDE.commands.console = function( cmd, t ) { WIDE.toggleConsole(); }
WIDE.commands.clear = function( cmd, t ) { WIDE.console_element.innerHTML = ""; }

//buttons
WIDE.buttons.push({ name:"new", icon:"elusive-file-new", command: "new"});
WIDE.buttons.push({ name:"current files", className:'open-files-button selected', icon:"bootstrap-file", command: "files" });
WIDE.buttons.push({ name:"open file", className:'list-files-button', icon:"bootstrap-folder-open", command: "list" });
WIDE.buttons.push({ name:"save current", icon:"bootstrap-import", command: "save" });
WIDE.buttons.push({ name:"show console", icon:"icomoon-terminal", command: "console" });
WIDE.buttons.push({ name:"execute code", icon:"bootstrap-play", command: "execute" });

//helpers
function queryforEach( selector,callback ) { var list = document.querySelectorAll(selector); for(var i = 0;i < list.length; ++i) callback( list[i] ); }

//redirect console
console._log = console.log;
console._warn = console.warn;
console._error = console.error;
console._clear = console.clear;
console.log = function(){ console._log.apply(console,arguments); WIDE.toConsole( Array.prototype.slice.call(arguments).map(function(a){ return String(a); }).join(","),"log");  };
console.warn = function(){ console._warn.apply(console,arguments); WIDE.toConsole( Array.prototype.slice.call(arguments).map(function(a){ return String(a); }).join(","),"warn"); };
console.error = function(){ console._error.apply(console,arguments); WIDE.toConsole( Array.prototype.slice.call(arguments).map(function(a){ return String(a); }).join(","),"error"); };
console.clear = function(){ console._clear(); WIDE.commands.clear(); };

WIDE.init();
console.log("wide editor created by Javi Agenjo (@tamat) 2018");
console.log("************************************************");

