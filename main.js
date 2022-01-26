const { app, BrowserWindow, ipcMain } = require('electron')
const moment = require('moment');
const momentTz = require('moment-timezone');
moment.tz.setDefault('Africa/Cairo');
const fs = require('fs');
// Type 3: Persistent datastore with automatic loading
const { AsyncNedb } = require('nedb-async')

const db = new AsyncNedb({
  filename: 'database.db',
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
    win.loadFile('index.html')
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

            let imageName = `${data.militaryNumber.length? data.militaryNumber : currentTime}.${(data.image.split('.')).at(-1)}`;
            await fs.copyFile(data.image,`./social-card-images/${imageName}`, (err) => {
                if (err) throw Error('يجب إدخال صورة');
            })
            data.image = imageName;
            await db.asyncInsert({dateOfEntry : moment().format("YYYY-MM-DD HH:mm:ss.SS") ,...data});
            return {success : true, message : 'تم ادخال المعلومات بنجاح'}
        } catch (error) {
            console.log(error);
            return {success : false, message : `Error: ${error}` };
        }
    }
    else if(functionName == 'update'){
        try {
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
        await fs.rm(`./social-card-images/${imageName}`, (err) => {});

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
            return {success : true, message : "", data : docs};
        } catch (error) {
            return {success : false, message : error};
        }  
    }
    
});

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
