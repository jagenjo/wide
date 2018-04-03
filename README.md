# wide

WIDE is a Web IDE based in monaco-editor, it allows to edit remote files in your own server quite easily, instead of having to use local files or uploading files through SFTP.

It allows to open several files, to browser remote folders, and the privileges are based in a config.json that you can store server side.

![WIDE preview](wide_preview.PNG "WIDE preview")

## Features

- Cool text editor with nice syntax highlighting (uses monaco-editor, the editor from VSCode).
- Load/Save remote files 
- Browser server files
- Saves the session (restores the state when opening the editor again)
- Console to launch commands (easy to add new ones) or to visualize logs
- Allows to "execute" the project 
- Very simple, only three files in total (html,js,php), does not use any build script nor ES6 features.
- Easy to install (does not require launching any daemon or having a configure a database).


## Security

The way it grants access to the files in the server is by using a key to have access to a server folder.
The first time using the editor you must set the key using the lower console bar, and it is stored in localStorage.

When accessing the server (load file, store, browse) it sends the key in the request header, and the server checks if the key matches any of the keys in its project list (configured in the wide_config.json). 

This is a layer of security but it could be easily hacked, so **do not use wide.js if your code is very sensitive to people trying to hack you**.

## Installation

Copy all repository files to a folder in your host accessible from HTTP.

Create the ```wide_config.json``` in a folder **that is not accessible through HTTP**, like ```/home/``` or ```/home/YOUR_USERNAME```. If the ```wide_config.json``` is accessible through HTTP people will be able to see your keys and have access to execute malicious code in your host, so you will have a serious security risk in your server, be careful.

The config should be like this:

```json
{
        "projects":{
                "PROJECT_KEY": {
                        "name":"Project1",
                        "folder":"/srv/www/mysite.com/www/public_html/",
                        "play":"http://mysite.com/"
                },
                "PROJECT_KEY2": {
                        "name":"Project2",
                        "folder":"/srv/www/mysite2.com/www/public_html/",
                        "play":"http://mysite2.com/"
                }
        }
}
```

Where ```PROJECT_KEY``` is the key that grants you access to that folder (and all its subfolders).

Once installed, you access the website and set the key typing in the bottom bar:
```
key PROJECT_KEY
```

You can use the buttons on top of the sidebar to browser server files.

## Contact

For any suggestions or comments, you can contact me at javi.agenjo@gmail.com



