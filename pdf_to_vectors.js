const prompt = require('prompt-sync')();
const URStateData = require('ur-state-receiver')
//const robot_ip   = '10.8.8.162'
const robot_ip   = '192.168.1.149'
const urStateDataInst = new URStateData(30003, robot_ip)

const pdfname    = 'Rajz vektor PDF.pdf'
//const svgname    = 'MiIim Nava.svg'
const svgname    = 'rajzos_vonalak.svg'
const tcp_spos   = 'p[0,0,0.116,0,0,0]'
const robot_spos = [
    [ -307.5, 172.1, -3.2, 0, 0, 0 ],
    [ -516.4, 175.6, -3.2, 0, 0, 0 ],
    [ -303.6, 468.0, -3.2, 0, 0, 0 ]
]

var myURstate = {}

// Request data from server.. [Does not work...]
// TODO: Make it work..
async function startRobotServeer() {
    urStateDataInst.on('data', (data) => (myURstate = data))

    urStateDataInst.on('error', (exception) => console.log(exception))

    urStateDataInst.on('drain', () => console.log('drain'))

    urStateDataInst.on('timeout', () => console.log('timeout'))

    urStateDataInst.on('close', () => console.log('close'))
}
//startRobotServeer()

// Reads line vectors from pdf file (uses old ONYX pdf format, does not work after update) 
// Returns: 
//      [ {pagesize::Array [ x, y ], lines::Array [ { rect::Array [ x, y ], verticies::Array [ [ x, y ], ... ] } ] }]
// 
function readVerices(filename) {

    // Read the file and print its contents.
    var fs = require('fs')
    var counter = 0
    var onyx_pdf = false
    var currpage = -1

    var vectors = [] // [page][line]

    const data = fs.readFileSync(filename, 'utf8')
    console.log('OK: ' + filename);

    data.split(/\r?\n/).forEach(line => {
        if (!onyx_pdf && counter > 10) {
            console.log("The provided file is not from ONYX. or not an old type.")
            return 0
        }
        if (!onyx_pdf) {
            if (line.startsWith("<</ONYX")) {
                onyx_pdf = true
            }
        }    
        
        if (counter == 0) {
            vectors.push({
                pagesize: [0, 0],
                lines: []
            }) // newpage
            currpage++
        }
        if (line.startsWith("<</AP")) {
            rects = []
            verts = []
            new_vert = {}
            is_x = true
            
            line.split("/Rect[ ")[1].split("]/")[0].split(" ").forEach(data => {
                if (is_x) new_vert.x = parseFloat(data)
                else {
                    new_vert.y = parseFloat(data)
                    rects.push([new_vert.x, new_vert.y])
                }
                is_x = !is_x
            })

            line.split("/Vertices[ ")[1].split("]/")[0].split(" ").forEach(data => {
                if (is_x) new_vert.x = parseFloat(data)
                else {
                    new_vert.y = parseFloat(data)
                    verts.push([new_vert.x, new_vert.y])
                }
                is_x = !is_x
            })
            
            vectors[currpage].lines.push({
                rect:      rects,
                verticies: verts
            })
        }
        else if (line.includes("/MediaBox")) {
            dimms = line.split("/MediaBox[ ")[1].split("]/")[0].split(" ")
            
            vectors[currpage].pagesize = [parseFloat(dimms[2]), parseFloat(dimms[3])]
        }

        counter++
    });
    
    //console.log(`Line from file: ${vectors[0].lines[0].rect[0][0]} ${typeof(vectors[0].lines[0].rect[0][0])}`);
    //console.log(`Line from file: ${vectors[0].lines[0].rect[0][1]} ${typeof(vectors[0].lines[0].rect[0][1])}`);
    //console.log(`Line from file: ${vectors[0].lines[0].verticies[0][0]} ${typeof(vectors[0].lines[0].verticies[0][0])}`);
    //console.log(`Line from file: ${vectors[0].lines[0].verticies[0][1]} ${typeof(vectors[0].lines[0].verticies[0][1])}`);
    return vectors
}


// Reads line vectors from svg file (used instead of new ONYX pdf format) 
// Returns: 
//      [ {pagesize::Array [ x, y ], lines::Array [ { rect::Array [ x, y ], verticies::Array [ [ x, y ], ... ] } ] }]
// 
function readVericesFromSVG(filename) {

    // Read the file and print its contents.
    var fs = require('fs')
    var counter = 0
    var currpage = -1
    var vectors = [] // [page][line]

    const data = fs.readFileSync(filename, 'utf8')
    console.log('OK: ' + filename);

    llast = {x:0, y:0}
    found_size = false
    data.split(/\r?\n/).forEach(line => { 
        
        if (counter == 0) {
            vectors.push({
                pagesize: [0, 0],
                lines: []
            }) // newpage
            currpage++
        }

        verts = []
        if (line.startsWith("<path")) {
            new_vert = {}
            is_x = true
            
            line.split("d=\"")[1].split(" \"")[0].split(" ").forEach(data => {
                if (!(data == "M" || data == "L" || data == "Z")) {
                    if (is_x) new_vert.x = parseFloat(data)
                    else {
                        new_vert.y = parseFloat(data)
                        verts.push([new_vert.x, new_vert.y])
                    }
                    is_x = !is_x
                }
            })
            
            //console.log(verts[0][0], verts[0][1], llast)
            if (verts[0][0] != llast.x && verts[0][1] != llast.y) {
                //console.log(verts)
                vectors[currpage].lines.push({
                    rect:      null,
                    verticies: verts
                })
                verts = []  
            }
            llast = new_vert  
        }
        else if (line.startsWith("<use") && line.includes("width") && !found_size) {
            dimms = line.split('"')
            
            // <use xlink:href="#im1" x="0" y="0" width="2808" height="3744"/>
            vectors[currpage].pagesize = [parseFloat(dimms[7]), parseFloat(dimms[9])]
            //console.log(vectors[currpage].pagesize, dimms[7], dimms[9], line)
            found_size = true
        }
        else if (line.startsWith("<image") && line.includes("width") && !found_size) {
            dimms = line.split('"')
            
            // <use xlink:href="#im1" x="0" y="0" width="2808" height="3744"/>
            vectors[currpage].pagesize = [parseFloat(dimms[3]), parseFloat(dimms[5])]
            //console.log(vectors[currpage].pagesize, dimms[3], dimms[5], line)
            found_size = true
        }

        counter++
    });
    
    //console.log(`Line from file: ${vectors[0].lines[0].rect[0][0]} ${typeof(vectors[0].lines[0].rect[0][0])}`);
    //console.log(`Line from file: ${vectors[0].lines[0].rect[0][1]} ${typeof(vectors[0].lines[0].rect[0][1])}`);
    //console.log(`Line from file: ${vectors[0].lines[0].verticies[0][0]} ${typeof(vectors[0].lines[0].verticies[0][0])}`);
    //console.log(`Line from file: ${vectors[0].lines[0].verticies[0][1]} ${typeof(vectors[0].lines[0].verticies[0][1])}`);
    return vectors
}

// Generates trajectories on paper coordinate system or papaer space.
// Teh origo is usually the bottom left corner of the paper.
function generateTrajectories(vects) {
    //(vects) => console.log(vects, "\n\nlines:\n", vects[0].lines, "\n\nvertives\n", vects[0].lines[0].verticies)

    traj_map = {
        size: vects[0].pagesize,
        trajs: []
    }

    vects.forEach(vect => {
        traj = []

        vect.lines.forEach(line => { // Go trough lines and set a [z] value for them on lifting pen up and down
            traj.push([ line.verticies[0][0], line.verticies[0][1],  1 ]) // [ x, y, z ] position pen over the first line
            
            line.verticies.forEach(vert => {
                traj.push([ vert[0], vert[1], 0 ])  // keep values at paper 0 so the pen will draw.
            })

            last_elm = line.verticies.length - 1
            traj.push([ line.verticies[last_elm][0], line.verticies[last_elm][1],  1 ]) // [ x, y, z ] lift pen up after finisghed line
        })

        traj_map.trajs.push(traj)
    })

    return traj_map
}

// Generates julia code to plot out, and draw the vectors is 3D
// Might need to rewrite for Python or edit the compleated julia code.
function genPlotJL(traj, name = null) {
    coord_data = "using PyPlot\n\narrx = [ "
    traj.forEach(traj => {
        coord_data += traj[0] + ', '
    })
    coord_data += " ]\n"
    coord_data += "arry = [ "
    traj.forEach(traj => {
        coord_data += traj[1] + ', '
    })
    coord_data += " ]\n"
    coord_data += "arrz = [ "
    traj.forEach(traj => {
        coord_data += traj[2] + ', '
    })
    coord_data += " ]\n\nplot3D(arrx, arry, arrz)\n\n"

    fs = require('fs');
    fname = name && name != '' ? `visualize_points_${name}.jl` : 'visualize_points.jl'
    fs.writeFile(fname, coord_data, (err) => {
        console.log(err);
    })
}

function wfkeypress(msg) {
    prompt(msg);    // Waits for keypress with package.. Might not work and have no pourpose yet. See getPositionFromRobot() if it have a meaning..
}

var called = 0
// Gets current TCP coordinates from the robot.
// Mainly used for paper calibration.
// Currently used statically and in code have no pourpose, but kills time and you have to press Enters..
// TODO: Make it work like it should.. Nedds to read coordinates from robot.
function getPositionFromRobot() {
    
    if (called > 2) {
        called = 0
    }
    /*if (1 == called) {
        ret =  [ -516.4, 175.6, 94.9, 0, 0, 0 ]
    }
    if (2 == called) {
        ret =  [ -303.6, 468.0, 94.7, 0, 0, 0 ]
    }*/

    console.log(myURstate)

    ret = robot_spos[called]
    called++

    return ret
    // return [ x, y, z, ?? roll, pitch, yaw ]
}

// Read coordinates from robot to calibrate the papers coordinate system.
function readPageCoordinateSystemFromRobot() {

    // reading the page's origo
    console.log('Set robot over the page\'s origo...')
    wfkeypress('Press any key if robot on position.');
    poso = getPositionFromRobot() // read origo (paper bottom left corner)

    // reading y max
    console.log('Set robot over the page\'s y maximum...')
    wfkeypress('Press any key if robot on position.');
    posy = getPositionFromRobot() // read y vector max value (paper upper left corner)

    // reading x max
    console.log('Set robot over the page\'s x maximum...')
    wfkeypress('Press any key if robot on position.');
    posx = getPositionFromRobot() // read x vector max value (paper bototom right corner)


    // convert x any y into vectors
    vector_y = [ posy[0] - poso[0], posy[1] - poso[1], posy[2] - poso[2] ]
    vector_x = [ posx[0] - poso[0], posx[1] - poso[1], posx[2] - poso[2] ]

    // calculate length of paper
    len_x = Math.sqrt(vector_x[0]*vector_x[0] + vector_x[1]*vector_x[1] + vector_x[2]*vector_x[2]) 
    len_y = Math.sqrt(vector_y[0]*vector_y[0] + vector_y[1]*vector_y[1] + vector_y[2]*vector_y[2])
    
    // scaling to the page wectors afterwards
    page_scale = [ len_x, len_y ]

    /*
    sk_xy = vector_x[0] * vector_y[0] + vector_x[1] * vector_y[1] + vector_x[2] * vector_y[2] 
    Theta = Math.scos((sk_xy) / (len_x * len_y))
    */

    // calculating x x y vectorial multiplication
    vector_z = [ vector_x[1] * vector_y[2] - vector_x[2] * vector_y[1],
                 vector_x[2] * vector_y[0] - vector_x[0] * vector_y[2],
                 vector_x[0] * vector_y[1] - vector_x[1] * vector_y[0] ]

    len_z = Math.sqrt(vector_z[0]*vector_z[0] + vector_z[1]*vector_z[1] + vector_z[2]*vector_z[2])
    
    // normalize vectors
    function normalize(a, len) {
        // na = a * (1/|n|)
        len_inv = 1 / len
        return [ a[0] * len_inv, a[1] * len_inv, a[2] * len_inv ]
    }

    norm_x = normalize(vector_x, len_x)
    norm_y = normalize(vector_y, len_y)
    norm_z = normalize(vector_z, len_z)


    return {
        scale: {
            x: page_scale[0],
            y: page_scale[1]
        },
        origo: poso,
        y_max: posy,
        x_max: posx,
        n: {
            x: norm_x,
            y: norm_y,
            z: norm_z
        }
    }

}





// Convert positions to real coordinate system
function scale_traj_to_robot_coordinates(page, traj, size) {
    ntraj = []

    // rotation might not work
    if (size[0] < size[1]) {
        console.log("Page was standing.. rotating coordinates for use.")

        /*
        traj.forEach(vect => {
            // (x, y, z) -> (y, x, z)  rotate
            ntraj.push([ vect[0], vect[1], vect[2] ])
        })

        traj = ntraj
        ntraj = []
        */

        rotate = true
    }
    else rotate = false

    scale = {
        x: page.scale.x / size[rotate ? 1 : 0],
        y: page.scale.y / size[rotate ? 0 : 1],
        z: 10
    }

    console.log(scale)

    // rescale and translate to robot pos [m]f
    traj.forEach(vect => {
        // (x, y, z) -> (y, x, z, up)  rotate  (only translation might need rotation if yout x and y is not parallel with the robots)
        ntraj.push([ (vect[0] * scale.x + page.n.x[0] + page.n.y[0] + page.n.z[0] + page.origo[0] - page.scale.y)       / 1000, 
                     (vect[1] * scale.y + page.n.x[1] + page.n.y[1] + page.n.z[1] + page.origo[1] + 10 /* offset */)    / 1000,
                     (vect[2] * scale.z + page.n.x[2] + page.n.y[2] + page.n.z[2] + page.origo[2])                      / 1000,
                     vect[2] > 0 ? true : false
                   ])
    })

    return ntraj
}


function sendTrajToRobot(traj) {
    // Do da magic..

    // set TCP rotation
    srot = '1.69,1.82,-0.5'
    //srot = '2.5,2.5,0'
    //srot = '-2.856,-0.275,1.531'
    //srot = '2.221,2.2215,0'
    //srot = '0,0,0'

    // We will send a robot program, you can also send it line by line for better control.

    stext = 'def printProgram():\n'     // def robot function
    stext += `set_tcp(${tcp_spos})\n`   // set robot TCP location (read out from handler YOU MUST DO IT OR THE TCP WILL BE THE ROBOTS DEFAULT IN THIS PROGRAM!)
    // Do joint space move.. translate from coordinates p(x, y, z, roll, pitch, yaw), t: time to move into point
    stext += `servoj(get_inverse_kin(p[${traj[0][0]},${traj[0][1]},${traj[0][2]},${srot}]),t=2)\n`
    traj.forEach(t => {
        stext += `servoj(get_inverse_kin(p[${t[0]},${t[1]},${t[2]},${srot}]),t=${ t[3] ? 0.5 : 0.01})\n`
    })
    stext += 'end\n'
    //console.log(stext)

    //return
    fs = require('fs');
    fs.writeFile('stext.txt', stext, (err) => {
        console.log(err);
    })

    //return

    // send tarjectories program to robot trough net socket
    var net = require('net')

    var client = new net.Socket()
    client.connect(30002, robot_ip, function () {
    console.log('CONNECTED')

    client.write(stext)
    console.log('DATA SENT')
    })

    client.on('data', function (data) {
    console.log('DATA RECEIVED:')
    console.log(data)
    client.destroy()
    })

    client.on('close', function () {
    console.log('CONNECTION CLOSED')
    })

}



//pdfname = 'Rajz vektor PDF 2.pdf'
//pdfname = 'Sarok teszt.pdf'

//vects = readVerices(pdfname)
vects = readVericesFromSVG(svgname)
//.then((vects) => {

//console.log(vects, "\n\nlines:\n", vects[0].lines, "\n\nvertives\n", vects[0].lines[0].verticies)


traj_map = generateTrajectories(vects)
// genPlotJL(traj_map.trajs[0])

console.log(traj_map)
console.log(traj_map.trajs[0])

//TODO: convert values to meters
//TODO: change coordinate system to tool, depending on the paper location
//VAGY: 4 sarokpont és scale

page = readPageCoordinateSystemFromRobot()
traj = scale_traj_to_robot_coordinates(page, traj_map.trajs[0], traj_map.size)
// genPlotJL(traj, 'new_translated_trajectories')



// This is just for my case.. You can only send around 2000 lines of code to the UR robot in a function, so I needed to cut my code..
// It did't work with 3000 lines... only tried descending from 7000.
// TODO: Make sending do this, and send only ntraj after each other (no def function...)

max_line = 2000
ntraj = []
if (traj.length > max_line) {
    tt = []

    for (let i = 0; i < traj.length; i++) {
        tt.push(traj[i])
        if (i != 0 && i % max_line == 0) {
            ntraj.push(tt)
            tt = []
        }
    }
    ntraj.push(tt)
}
else ntraj = [traj]
console.log(ntraj, ntraj.length)

ntraj.forEach(t => {
    sendTrajToRobot(t) // send trajectories to robot.
})


//})


