const { app, BrowserWindow, ipcMain, shell,webContents } = require('electron')
const moment = require('moment');
const momentTz = require('moment-timezone');
moment.tz.setDefault('Africa/Cairo');
const fs = require('fs');
// Type 3: Persistent datastore with automatic loading
const { AsyncNedb } = require('nedb-async')
const resolve = require('path').resolve;


const db = new AsyncNedb({
  filename: ('../database.db').replace('/app.asar', ''),
  autoload: true,
})

let mainWindow;
let dataEntryWindow;
let dataRetrievalWindow;



// A function that creates a window within the electron app
function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 500,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        show: false,
    })
    win.loadFile(__dirname + "/index.html");
    win.show();
    mainWindow = win;
}


// Function to create child window of parent one
function createDataEntryWindow() {
    let childWindow = new BrowserWindow({
      width: 800,
      height: 900,
      modal: true,
      show: false,
      parent: mainWindow, // Make sure to add parent window here
    
      // Make sure to add webPreferences with below configuration
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
      },
    });
    
    childWindow.loadFile("./html-files/data-entry.html");
    
    childWindow.once("ready-to-show", () => {
      childWindow.show();
    });

    dataEntryWindow = childWindow;
}

// Function to create child window of parent one
function createDataRetrievalWindow() {
    let childWindow = new BrowserWindow({
      width: 800,
      height: 900,
      modal: true,
      show: false,
      parent: mainWindow, // Make sure to add parent window here
    
      // Make sure to add webPreferences with below configuration
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
      },
    });
    
    childWindow.loadFile("./html-files/data-retrieval.html");
    
    childWindow.once("ready-to-show", () => {
      childWindow.show();
    });

    dataRetrievalWindow = childWindow;
}
    

ipcMain.on("createDataEntryWindow", (event, arg) => {
    createDataEntryWindow();
});

ipcMain.on("closeDataEntryWindow", (event, arg) => {
    dataEntryWindow.close();
});

ipcMain.on("createDataRetrievalWindow", (event, arg) => {
    createDataRetrievalWindow();
});

ipcMain.on("closeDataRetrievalWindow", (event, arg) => {
    dataRetrievalWindow.close();
});

ipcMain.handle('socialCard', async (event, args) => {
    let { functionName, data} = args;
    let currentTime = moment().format("YYYY-MM-DD HH:mm:ss.SS")
    // in case of insert
    if(functionName == 'insert'){
        try {
            let docs = await db.asyncFind({
                militaryNumber : data.militaryNumber
            });
            if(docs.length > 0){
                throw Error("هذا الرقم العسكري موجود بالفعل. لا يمكن ادخال أكثر من كارت اجتماعي لنفس الرقم العسكري.")
            }

            if(!data.militaryNumber || data.militaryNumber.length == 0){
                throw Error("يجب ادخال رقم عسكري")
            }

            if(data.image){
                let imageName = `${data.militaryNumber.length? data.militaryNumber : currentTime}.${(data.image.split('.')).at(-1)}`;
                await fs.copyFile(data.image,`../social-card-images/${imageName}`, (err) => {
                    if (err) throw Error('يجب إدخال صورة');
                })
                data.image = imageName;
            }

            if(data.document){
                let documentName = `${data.militaryNumber.length? data.militaryNumber : currentTime}.${(data.document.split('.')).at(-1)}`;
                await fs.copyFile(data.document,`../documents/${documentName}`, (err) => {
                    if (err) throw Error('يجب إدخال ملف');
                })
                data.document = documentName;
            }
            await db.asyncInsert({dateOfEntry : moment().format("YYYY-MM-DD HH:mm:ss.SS") ,...data});
            return {success : true, message : 'تم ادخال المعلومات بنجاح'}
        } catch (error) {
            console.log(error);
            return {success : false, message : `Error: ${error}` };
        }
    }
    else if(functionName == 'update'){
        try {
            console.log(data.image);
            if(data.image){
                let imageName = `${data.militaryNumber.length? data.militaryNumber : currentTime}.${(data.image.split('.')).at(-1)}`;
                await fs.copyFile(data.image,`../social-card-images/${imageName}`, (err) => {
                    if (err) throw Error('يجب إدخال صورة');
                })
                data.image = imageName;
            }
            console.log(data.document);
            if(data.document){
                let documentName = `${data.militaryNumber.length? data.militaryNumber : currentTime}.${(data.document.split('.')).at(-1)}`;
                await fs.copyFile(data.document,`../documents/${documentName}`, (err) => {
                    if (err) throw Error('يجب إدخال ملف');
                })
                data.document = documentName;
            }
            await db.asyncUpdate({_id : data._id}, {dateOfEntry : moment().format("YYYY-MM-DD HH:mm:ss.SS") ,...data});
            return {success : true, message : 'تم تحديث البيانات بنجاح'};
        } catch (err) {
            console.log(err);
            return {success : false, message : `Error: ${error}` };
        }
    }
    else if(functionName == 'delete'){
        let doc = await db.asyncFindOne({militaryNumber : data.militaryNumber});
        if(!doc){
            return {success : false, message : 'لا يوجد كارت اجتماعي بهذا الرقم العسكري'}
        }
        await db.asyncRemove({militaryNumber : data.militaryNumber});
        let imageName = `${data.militaryNumber.length? data.militaryNumber : currentTime}.${(data.image.split('.')).at(-1)}`;
        await fs.rm(`../social-card-images/${imageName}`, (err) => {});

        return {success : true, message : 'تم مسح الكارت الإجتماعي بنجاح'}
    }
    else if(functionName == 'get'){
        try {
            let docs = await db.asyncFind({
                $or:[
                    {name : data.searchQuery},
                    {militaryNumber : data.searchQuery},
                ]
            });
            if(docs.length === 0){
                throw Error("لا يوجد كارت إجتماعي بهذه المعطيات")
            }

            for(let doc of docs){
                doc.image = resolve("../social-card-images/" +  doc.image);
                doc.document = resolve( "../documents/" +  doc.document);
            }

            
            return {success : true, message : "", data : docs};
        } catch (error) {
            return {success : false, message : error};
        }  
    }
    
});

function pdfSettings() {
    var paperSizeArray = ["A4", "A5"];
    var option = {
        landscape: false,
        marginsType: 0,
        printBackground: false,
        printSelectionOnly: false,
        pageSize: paperSizeArray[0],
    };
  return option;
}

ipcMain.handle('print-to-pdf', async (event, args)=>{
    dataRetrievalWindow.webContents.printToPDF(pdfSettings()).then(data => {
        fs.writeFileSync('../tmp/'+ args.name, data, (err) => {
          if (err) throw err
        })
        shell.openPath(resolve('../tmp/'+ args.name));
      }
    )
})

// When ready hook for electron
app.whenReady().then(() => {
    // Create a window
    createWindow()

    // Double check if a window does not open, if no window is opened create a new one
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})



// When all windows are closed, quit the app
app.on('window-all-closed', function () {
    app.quit()
})
