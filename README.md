# wide.js

WIDE is a Web IDE based in monaco-editor, it allows to edit remote files in your own server quite easily, instead of having to use local files or uploading files through SFTP.

It allows to open several files, to browser remote folders, and the privileges are based in a config.json that you can store server side.

![WIDE preview](wide_preview.PNG "WIDE preview")

# usage

Copy all files to a folder in your host accessible from HTTP.

Create the ```wide_config.json``` in a folder that is not accessible through HTTP, like ```/home/``` or ```/home/YOUR_USERNAME''':

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



