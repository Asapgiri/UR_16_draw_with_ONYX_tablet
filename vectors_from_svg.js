const prompt = require('prompt-sync')();

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


traj_map = readVericesFromSVG('rajzos_vonalak.svg')
//traj_map = readVericesFromSVG('test.svg')
console.log(traj_map)
console.log(traj_map[0].lines[5])

