import {defined,html,save_json} from "./utils.js"
import * as vor_core from "../libs/rhill-voronoi-core.js"
import {Svg} from "./svg_utils.js"

let svg = new Svg()

function get_seeds(nb,w,h){
    let res = []
    for(let i = 0;i<nb; i++){
        res.push({
            id:i,
            x:Math.random()*w,
            y:Math.random()*h
        })
    }
    return res
}

function get_seed_samples(nb,w,h){
    let res = []
    for(let i = 0;i<nb; i++){
        res.push({
            x:Math.random()*w,
            y:Math.random()*h
        })
    }
    return res
}

function walls_distance(seed,w,h){
    let walls_dist = []
    walls_dist.push(Math.abs(seed.x))
    walls_dist.push(Math.abs(seed.y))
    walls_dist.push(Math.abs(w-seed.x))
    walls_dist.push(Math.abs(h-seed.y))
    return Math.min(...walls_dist)
}

function distance(s1,s2){
    const dx = s1.x-s2.x
    const dy = s1.y-s2.y
    return Math.sqrt(dx * dx + dy * dy)
}

function get_best_sample(seeds,samples,w,h,walls=false){
    let best_index = 0
    let biggest_min = 0
    for(let i=0;i<samples.length;i++){
        let seeds_cost = []
        for(let j= 0;j<seeds.length;j++){
            const d = distance(samples[i],seeds[j])
            seeds_cost.push(d)
        }
        if(walls){
            seeds_cost.push(walls_distance(samples[i],w,h))
        }
        const min_dist = Math.min(...seeds_cost)
        if(min_dist > biggest_min){
            best_index = i
            biggest_min = min_dist
        }
    }
    //console.log(`biggest_min = ${biggest_min}`)
    return samples[best_index]
}

function get_closest_index(seeds,coord){
    let index_of_closest = 0
    let closest_dist = Number.MAX_VALUE
    for(let i=0;i<seeds.length;i++){
        const d = distance(coord,seeds[i])
        if(d < closest_dist){
            index_of_closest = i
            closest_dist = d
        }
    }
    return index_of_closest
}
class Voronoi{
    constructor(parent,w,h){
        //const use_storage = false
        let init_needed = false
        this.version = "3"
        const config = JSON.parse(localStorage.getItem("voronoi_config"))
        if(config === null){
            console.log("First time usage, no config stored")
            init_needed = true
        }else{
            if(config.version == this.version){
                console.log(`same version ${this.version}, loading`)
                //console.log(config)
                Object.assign(this,config)
            }else{
                console.log(`version mismatch (localstorage = ${config.version} , loaded page = ${this.version}) reinitialising`)
                init_needed = true
            }
        }

        if(init_needed){
            this.seeds = []
            this.nb_seeds = 30;
            this.nb_samples = 10;
            this.walls_dist = false;
            this.sampling = false;
            this.path_width = 2;
            this.min_edge = 20
            this.is_color = false
            this.view_svg = {
                cells:true,
                edges:true,
                seeds:true
            }
            this.mouse_action = "nothing"
            this.export_svg = {
                cells:true,
                edges:false,
                seeds:false
            }
        }
        this.svg = {}
        this.svg.seeds = []
        this.svg.main = html(parent,"svg",
        /*html*/`<svg id="main_svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"></svg>`
        );
        this.svg.path = null;
        this.svg.cells = [];

        this.init_events()
    }
    
    get_seed(id,w,h){
        let samples = get_seed_samples(this.nb_samples,w,h)
        //console.log(samples)
        const best_seed = get_best_sample(this.seeds,samples,w,h,this.walls_dist)
        return {
            id:id,
            x:best_seed.x,
            y:best_seed.y
        }
    }

    add_seeds_sampling(nb){
        const w = this.svg.main.width.baseVal.value
        const h = this.svg.main.height.baseVal.value
        const prev_nb = this.seeds.length
        for(let i=0;i<nb;i++){
            const new_id = prev_nb+i
            const s = this.get_seed(new_id,w,h)
            this.seeds.push(s)
        }
    }

    add_seeds_random(nb){
        const w = this.svg.main.width.baseVal.value
        const h = this.svg.main.height.baseVal.value
        const prev_nb = this.seeds.length
        const new_seeds = get_seeds(nb,w,h)
        for(let i=0;i<nb;i++){
            const s = new_seeds[i]
            const new_id = prev_nb+i
            this.seeds.push({id:new_id,x:s.x,y:s.y})
        }
    }

    draw_seeds(){
        this.svg.seeds = svg.draw_seeds(this.svg.main,this.seeds)
    }

    draw_path(){
        console.time("draw path")
        this.svg.path = svg.draw_path(this.svg.main,this.res.edges,this.path_width)
        console.timeEnd("draw path")
    }

    set_path_width(width){
        this.path_width = width
        this.svg.path.setAttributeNS(null,"stroke-width",width)
        this.store()
    }

    draw_cells(){
        console.time("draw cells")
        //todo select color checkbox true false
        this.svg.cells = svg.draw_cells_bezier(this.svg.main,this.res.cells,this.min_edge,this.is_color)
        console.timeEnd("draw cells")
    }

    clear_svg(is_clear_seeds=true,is_clear_path=true,is_clear_cells=true){
        let children = [ ...this.svg.main.children];
        children.forEach((child)=>{
            child.parentElement.removeChild(child)
        })
    }

    draw(){
        this.clear_svg()
        if(this.view_svg.seeds){
            this.draw_seeds()
        }
        if(this.view_svg.edges){
            this.draw_path()
        }
        if(this.view_svg.cells){
            this.draw_cells()
        }
        this.store()
    }

    store(){
        let config = Object.assign({},this)
        delete config.svg
        delete config.seeds
        delete config.res
        console.log(`storing config version ${config.version}`)
        localStorage.setItem("voronoi_config",JSON.stringify(config))
    }

    compute_voronoi(){
        console.time("voronoi")
        let voronoi = new vor_core.Voronoi()
        const w = this.svg.main.width.baseVal.value
        const h = this.svg.main.height.baseVal.value
        this.res = voronoi.compute(this.seeds,{xl:0, xr:w, yt:0, yb:h})
        console.timeEnd("voronoi")
        //console.log(`stats : ${res.cells.length} cells , ${res.vertices.length} vertices , ${res.edges.length} edges`)
        this.draw()
    }

    update_seeds(clear){
        console.time("update_seeds")
        if(clear){
            this.seeds = []
        }
        if(this.nb_samples < this.seeds.length){
            const nb_pop = this.seeds.length - this.nb_samples
            for(let i=0;i<nb_pop;i++){
                this.seeds.pop()
            }
        }else if(this.nb_samples > this.seeds.length){
            if(this.sampling){
                this.add_seeds_sampling(this.nb_samples - this.seeds.length)
            }else{
                this.add_seeds_random(this.nb_samples - this.seeds.length)
            }
        }
        console.timeEnd("update_seeds")
        this.compute_voronoi()
    }

    set_seeds(seeds){
        this.seeds = seeds
        this.compute_voronoi()
    }

    add_seed(coord){
        const new_id = this.seeds[this.seeds.length-1].id + 1
        let s = {x:coord.x, y:coord.y, id:new_id}
        this.seeds.push(s)
        this.compute_voronoi()
    }

    remove_seed(coord){
        const closest = get_closest_index(this.seeds,coord)
        const seed_id = this.seeds[closest].id
        this.seeds.splice(closest,1)
        this.compute_voronoi()
    }

    move_seed(coord){
        const closest_index = get_closest_index(this.seeds,coord)
        let closest_seed = this.seeds[closest_index]
        closest_seed.x = coord.x
        closest_seed.y = coord.y
        const seed_id = this.seeds[closest_index].id
        this.compute_voronoi()
    }

    save_svg(fileName){
        this.clear_svg()
        if(this.export_svg.seeds){
            this.draw_seeds()
        }
        if(this.export_svg.edges){
            this.draw_path()
        }
        if(this.export_svg.cells){
            this.draw_cells()
        }
        svg.save(this.svg.main,fileName)
        this.draw()
    }

    save_seeds(fileName){
        this.seeds.forEach((s)=>{
            delete s.voronoiId
        })
        save_json(this.seeds,fileName)
    }

    load_dropped_seeds(file){
        let extension = file.name.split('.').pop();
        var reader = new FileReader();
        let is_valid = false;
        const vor_context = this
        if(extension == "json"){
            console.log("extention check - OK")
            reader.onloadend = function(e) {
                var result = JSON.parse(this.result);
                if(Array.isArray(result)){
                    console.log("array type - OK")
                    if(result.length > 0){
                        console.log("length - OK")
                        const seed0 = result[0]
                        if((defined(seed0.x)) && (defined(seed0.y)) &&(defined(seed0.id))){
                            console.log("seed structure - OK")
                            is_valid = true
                        }
                    }
                }
                if(is_valid){
                    vor_context.set_seeds(result)
                }else{
                    alert(`unsupported seeds format`);
                }
            };
        }
        else{
            alert(`unsupported file format`);
        }
        reader.readAsText(file);
    }

    init_events(){
        $(this.svg.main).click((e)=>{
            if(this.mouse_action == "add"){
                this.add_seed({x:e.clientX, y:e.clientY})
            }else if(this.mouse_action == "remove"){
                this.remove_seed({x:e.clientX, y:e.clientY})
            }
        })
        $(this.svg.main).mousemove((e)=>{
            if(this.mouse_action == "move"){
                if(e.buttons == 1){
                    this.move_seed({x:e.clientX, y:e.clientY})
                }
            }
        })
        $(this.svg.main).mousedown((e)=>{
            if(this.mouse_action == "move"){
                this.move_seed({x:e.clientX, y:e.clientY})
            }
        })
    }
}


export {Voronoi};
