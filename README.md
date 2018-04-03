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

The way it grants access to the files in the server is by using keys that grant you access to server folders.

The server owner creates a config file ```wide_config.json``` that contains keys associated to some server folders.

The first time using the editor in a browser you must set the key using the lower console bar, and it is stored in localStorage (not hashed though).

When accessing the server (load file, store, browse) it sends the key in the request header, and the server checks if the key matches any of the keys in its project list (configured in the ```wide_config.json```). If the server has the use_md5 feature enabled, it will hash first the key using md5 and then compare it with the one in the config file.

This is a layer of security that helps in case the config file is accessed by a malicious user, but it could still be easily hacked using an attack by dictionary, so **do not use wide.js if your code is very sensitive to people trying to hack you**.

## Installation

Copy all repository files to a folder in your host accessible from HTTP.

Create the ```wide_config.json``` in a folder **that is not accessible through HTTP**, like ```/home/``` or ```/home/YOUR_USERNAME```. If the ```wide_config.json``` is accessible through HTTP people will be able to see your keys (although if they are in md5 it still requires some work to get the key) and have access to execute malicious code in your host, so you will have a serious security risk in your server, be careful.

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

By default the keys in the config should be hashed using MD5, this way if the ```wide_config.json``` is read by an intruder, it still has a layer of security. To apply MD5 to your keys when writing the config, you can use: http://www.md5.cz/

You can disable the md5 in the server by changing the variable use_md5 to false ```$use_md5 = false;``` although I do not recommend it.

Once installed, you access the website and set the key typing at the bottom console bar:
```
key PROJECT_KEY
```

**The PROJECT_KEY is as it was before hashing it with md5.**

## Browse files

You can use the buttons on top of the sidebar to browser server files.

You cannot get into a level above the folder specified in the config.

## Contact

For any suggestions or comments, you can contact me at javi.agenjo@gmail.com



