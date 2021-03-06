const SETUP_FEN = "lnwlnlne5/lw1lejs3/lswlslseeh3/kqrbnp2/KQRBNP2/LnwLnLneEH3/Lw1LeJS3/LswLsLse5 w KQkq - 0 1"
const CLEAR_FEN = "4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1"

const RICH = true

const DEFAULT_SQUARESIZE = 57.5

const DEFAULT_BOARD_BACKGROUND = "maple.jpg"

const PIECE_LETTER_TO_SOUND = {
    n: "horseneigh",
    N: "horse",
    e: "blackelephant",
    E: "whiteelephant",
    r: "engine",
    R: "engine",
    q: "accengine",
    Q: "accengine",
    b: "acceleration",
    B: "acceleration",
    h: "blackhawk",
    H: "whitehawk",
    p: "steps",
    P: "steps",
    j: "lock",
    J: "lock",
    l: "lancer",
    L: "lancer",
    s: "sentry",
    S: "sentry",
    k: "king",
    K: "king",
}

const CANVAS_NAMES = [
    "background",
    "square",
    "check",
    "click",
    "highlight",            
    "weights",
    "showanalysis",
    "analysis",
    "drawings",            
    "piece",
    "dragpiece",
    "clicksquare",
    "gif"
]

const EXPORTED_CANVAS_NAMES = CANVAS_NAMES.filter(name => !["dragpiece", "gif"].includes(name))

const DEFAULT_SQUARE_OPACITY = 0.3

class Board_ extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.squaresize = this.props.squaresize || DEFAULT_SQUARESIZE

        this.squareopacity = this.props.squareopacity || DEFAULT_SQUARE_OPACITY

        this.positionchangedcallback = this.props.positionchangedcallback

        this.parentApp = this.props.parentApp

        this.game = Game({variant: this.props.variant || DEFAULT_VARIANT}).setfromfen()        

        this.canvasnames = CANVAS_NAMES
    }

    get g(){return this.game}
    get b(){return this.g.board}

    positionWheeled(ev){
        ev.preventDefault()
        if(ev.wheelDelta < 0) this.back()
        if(ev.wheelDelta > 0) this.forward()
    }

    init(){
        this.x()

        this.canvases = this.canvasnames.map(cn =>
            Canvas({width: this.boardsize(), height: this.boardsize()}).poa()
        )

        this.ae("wheel", this.positionWheeled.bind(this))

        this.a(
            div().w(this.boardsize()).h(this.boardsize()).por().a(
                this.canvases,
                this.resultDiv = div()
                    .op(0.8).poa().c("#00a").fwb()
                    .w(this.boardsize()).h(this.boardsize() * 0.6).dfcc().jcsa(),
                this.mouseDiv = div({ev: "dragstart mousemove mouseup", do: "dragpiece"}).w(this.boardsize()).h(this.boardsize()).poa().drgb(),
                this.mouseClickDiv = div().ae("click", this.handleAwaitSquareClick.bind(this)).w(this.boardsize()).h(this.boardsize()).poa().disp("none"),                
            )            
        )

        if(this.props.squareClickCallback) this.mouseDiv.ae("click", this.handleSquareClick.bind(this))

        this.draw()
    }

    handleSquareClick(ev){
        if(!this.props.squareClickCallback) return        
        let bcr = this.getCanvasByName("dragpiece").e.getBoundingClientRect()
        this.piececlickorig = Vect(ev.clientX - bcr.x, ev.clientY - bcr.y)        
        let clickedsq = this.coordstosq(this.piececlickorig)                                  
        let coords = this.fasquarecoords(clickedsq)
        let canvas = this.getCanvasByName("check")
        canvas.clear()
        canvas.fillStyle("#0f0")
        canvas.fillRect(coords, Vect(this.squaresize, this.squaresize))
        this.props.squareClickCallback(clickedsq)
    }

    reset(variant){
        this.g.reset(variant)
        return this.setgame(this.g)
    }

    coordstosq(coords){return this.fasq(Square(Math.floor(coords.x / this.squaresize), Math.floor(coords.y / this.squaresize)))}

    clearPiece(sq, canvasOpt){                    
        (canvasOpt || this.getCanvasByName("piece"))
            .clearRect(this.fasquarecoords(sq), Vect(this.squaresize, this.squaresize))        
    }

    getlms(RICH, decorate){
        let lms = this.b.legalmovesforallpieces()

        if(RICH) lms.forEach(lm => {
            lm.san = this.b.movetosan(lm)
            lm.gameNode = this.getcurrentnode().sortedchilds().find(child => child.gensan == lm.san)
            lm.evalWeight = 100000
            lm.hasEval = false
            if(lm.gameNode) if(lm.gameNode.hasEval){
                lm.hasEval = true
                lm.evalWeight -= lm.gameNode.eval
            }
            lm.gameMove = lm.gameNode ? 1 : 0
            lm.weights = lm.gameNode ? lm.gameNode.weights : [0, 0]
            lm.sortweight = lm.gameNode ? 1e6 + 1000 * ( lm.gameNode.sortweight() + 1 ) : 0            
        })

        if(decorate) lms.forEach(lm => {
            lm.decorate = decorate.moves.find(move => move.san == lm.san)            
            if(lm.decorate){
                lm.decorate.total = lm.decorate.white + lm.decorate.draws + lm.decorate.black
                lm.decorate.perf = lm.decorate.white + 0.5 * lm.decorate.draws
                lm.decorate.perfpercent = Math.round(lm.decorate.perf / lm.decorate.total * 100)
                if(!this.b.turn) lm.decorate.perfpercent = 100 - lm.decorate.perfpercent
                if(!lm.hasEval) lm.sortweight += 100 + 100 * lm.decorate.total / ( decorate.white + decorate.draws + decorate.black )
            }
        })

        return lms
    }

    makeMove(move){                
        let trueMove = this.getlms().find(lm => lm.strictlyEqualTo(move))
        if(!trueMove) return
        move = trueMove
        let san = this.b.movetosan(move)
        this.g.makemove(move)
        this.positionchanged()
        if(this.props.makeMoveCallback){
            this.props.makeMoveCallback(san)
        }
    }

    handleAwaitSquareClick(ev){                                
        if(!this.awaitSquareClick) return
        let bcr = this.getCanvasByName("dragpiece").e.getBoundingClientRect()
        this.piececlickorig = Vect(ev.clientX - bcr.x, ev.clientY - bcr.y)        
        this.clickedsq = this.coordstosq(this.piececlickorig)                          
        if(this.inputtedMove){            
            this.buildPromotionSquares(null, this.clickedsq)
        }
    }

    buildPromotionSquares(piecesOpt, clickedSqOpt){               
        this.promotionPieces = piecesOpt || this.promotionPieces        
        if(!this.promotionPieces) return                
        let osq = this.inputtedMove.tosq
        let canvas = this.getCanvasByName("clicksquare")      
        canvas.globalAlpha(0.7)
        let allsqs = this.promotionPieces.map(p => osq.adddelta(p.direction))
        let minx = allsqs.reduce((prev, curr) => curr.file < prev ? curr.file : prev, NUM_SQUARES)
        let maxx = allsqs.reduce((prev, curr) => curr.file > prev ? curr.file : prev, 0)
        let miny = allsqs.reduce((prev, curr) => curr.rank < prev ? curr.rank : prev, NUM_SQUARES)
        let maxy = allsqs.reduce((prev, curr) => curr.rank > prev ? curr.rank : prev, 0)
        let corr = SquareDelta(0, 0)
        if(minx < 0) corr.x = -minx
        if(maxx > LAST_SQUARE) corr.x = LAST_SQUARE - maxx
        if(miny < 0) corr.y = -miny
        if(maxy > LAST_SQUARE) corr.y = LAST_SQUARE - maxy        
        for(let p of this.promotionPieces){
            let sq = osq.adddelta(p.direction).adddelta(corr)
            if(clickedSqOpt){                                     
                if(sq.equalto(clickedSqOpt)){                                        
                    let move = this.inputtedMove                    
                    if(move.promsq){
                        move.promsq = sq
                    }else{
                        move.prompiece = p          
                        if(p.kind != "l") move.prompiece.direction = null                       
                    }                    
                    let nudgeMove = this.nudgeMove
                    let nudgeMoves = this.nudgeMoves                    
                    this.clearAwaitSquareClick()       
                    this.draw()                                                            
                    if(p.kind != "x"){
                        if(nudgeMove){                            
                            nudgeMove.prompiece.direction = SquareDelta(
                                sq.file - nudgeMove.promsq.file,
                                sq.rank - nudgeMove.promsq.rank
                            )
                            this.makeMove(nudgeMove)
                        }else{
                            this.nudgeMove = nudgeMoves.find(nm => nm.promsq.equalto(sq))                                                    
                            if(this.nudgeMove){                            
                                this.makeMove(this.nudgeMove)                        
                                return // disallow changing lancer direction
                                this.inputtedMove = Move(this.nudgeMove.fromsq, this.nudgeMove.promsq)
                                this.awaitSquareClick = true
                                this.buildPromotionSquares(LANCER_PROMOTION_PIECES(!this.b.turn, ADD_CANCEL))
                            }else{
                                this.makeMove(move)                        
                            }
                        }                        
                    }
                    return
                }
            }else{
                canvas.fillStyle("#ff0")            
                canvas.fillRect(this.fasquarecoords(sq), Vect(this.squaresize, this.squaresize))
                this.drawPiece(canvas, this.piececoords(sq), p)
            }            
        }                        
        this.mouseClickDiv.disp("initial")
    }

    handleValidMoveInput(valid, allValid){
        this.nudgeMoves = []

        if(valid.prompiece && (this.draggedpiece.kind != "l") && (this.draggedpiece.kind != "s")){                            
            this.awaitSquareClick = true
            this.inputtedMove = valid            
            this.buildPromotionSquares(this.b.PROMOTION_PIECES(this.b.turn, ADD_CANCEL))
            return
        }

        if(valid.promsq){            
            this.nudgeMoves = allValid.filter(v => v.nudge)            
            this.awaitSquareClick = true
            this.inputtedMove = valid
            let psqs = allValid.map(v => Piece(v.prompiece.kind, v.prompiece.color,
                SquareDelta(v.promsq.file - valid.tosq.file, v.promsq.rank - valid.tosq.rank)))            
            psqs.push(Piece("x", BLACK, SquareDelta(0, 0)))
            this.getCanvasByName("highlight").clear()
            this.buildPromotionSquares(psqs)
            return
        }

        if(valid.placeMove){
            let pstore = this.b.pieceStoreColor(this.b.turn)
            if(pstore.length){
                if(this.b.squareStore().find(sq => sq.equalto(valid.fromsq))){
                    let placeKind = window.prompt(`Place piece, ${pstore.map(p => p.kind + " = " + DISPLAY_FOR_PIECE_LETTER[p.kind]).join(" , ")}  [ Enter / Ok = None ] : `)
                    if(placeKind){
                        let pf = pstore.find(tp => tp.kind == placeKind)
                        if(pf){
                            valid.placePiece = pf
                        }
                    }
                }                                
            }                            
        }

        if(valid.castling){
            let pstore = this.b.pieceStoreColor(this.b.turn)
            if(pstore.length){
                let placeKind = window.prompt(`Place piece, ${pstore.map(p => p.kind + "k = " + DISPLAY_FOR_PIECE_LETTER[p.kind] + " @ King , " + p.kind + "r = " + DISPLAY_FOR_PIECE_LETTER[p.kind] + " @ Rook").join(" , ")}  [ Enter / Ok = None ] : `)
                if(placeKind) if(placeKind.length > 1){
                    let pf = pstore.find(tp => tp.kind == placeKind.substring(0,1))
                    if(pf){
                        valid.placeCastlingPiece = pf
                        valid.placeCastlingSquare = placeKind.substring(1, 2) == "k" ?
                            valid.fromsq
                                :
                            valid.delrooksq
                        valid.san += "/" + pf.kind.toUpperCase() + this.b.squaretoalgeb(valid.placeCastlingSquare)
                    }
                }
            }
        }                        

        if( (this.draggedpiece.kind == "l") && (!valid.keepDirection) ){                            
            this.awaitSquareClick = true
            this.inputtedMove = valid            
            this.buildPromotionSquares(LANCER_PROMOTION_PIECES(this.b.turn, ADD_CANCEL))
            return
        }

        let username = "@nonymous"
        if(typeof PROPS != "undefined"){
            if(typeof PROPS.USER != "undefined"){
                username = PROPS.USER.username
            }
        }
        fetch('/logmove', {
            method: "POST",
            headers: {
               "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                san: this.b.movetosan(valid),
                game: this.g.serialize()
            })
        })
        
        if(this.parentApp.trainMode == this.b.turnVerbal){
            let candidates = this.getcurrentnode().sortedchilds().filter(child => child.weights[0])
            if(candidates.length == 0){
                return this.parentApp.trainingLineCompleted()
            }else{
                if(candidates.find(cand => cand.gensan == this.b.movetosan(valid))){
                    this.makeMove(valid)
                }else{
                    this.parentApp.alert("Wrong move", "error")
                    this.forceWeights = true
                    this.draw()
                }
            }
        }else{            
            this.makeMove(valid)
        }                            
    }

    handleEvent(sev){
        if(sev.do == "dragpiece"){
            let bcr = this.getCanvasByName("dragpiece").e.getBoundingClientRect()            
            let dragpiececanvas = this.getCanvasByName("dragpiece")

            switch(sev.kind){                
                case "dragstart":
                    sev.ev.preventDefault()                        

                    if(this.props.squareClickCallback) return

                    if(this.g.terminated) return
                    if(this.awaitSquareClick) return                    

                    this.piecedragorig = Vect(sev.ev.clientX - bcr.x, sev.ev.clientY - bcr.y)        
                    this.draggedsq = this.coordstosq(this.piecedragorig)        
                    this.draggedpiece = this.b.pieceatsquare(this.draggedsq)

                    if(!this.draggedpiece.isempty()){
                        this.draggedpiececoords = this.piececoords(this.draggedsq)        
                        this.clearPiece(this.draggedsq)
                        this.piecedragon = true            
                    }        
                    break
                case "mousemove":
                    if(!this.piecedragon) return
                    
                    this.piecedragvect = Vect(sev.ev.clientX - bcr.x, sev.ev.clientY - bcr.y)
                    this.piecedragdiff = this.piecedragvect.m(this.piecedragorig)
                    this.dragtargetsq = this.coordstosq(this.piecedragvect)                    

                    dragpiececanvas.clear()

                    this.drawPiece(dragpiececanvas, this.draggedpiececoords.p(this.piecedragdiff), this.draggedpiece)
                    break
                case "mouseup":
                    if(!this.piecedragon) return

                    this.piecedragon = false
                    
                    dragpiececanvas.clear()            

                    if(!this.dragtargetsq){
                        this.draw()
                        return
                    }

                    this.drawPiece(dragpiececanvas, this.piececoords(this.dragtargetsq), this.draggedpiece)
        
                    let move = Move(this.draggedsq, this.dragtargetsq)
                    
                    let lms = this.getlms()

                    let valid = lms.find(testmove => testmove.roughlyequalto(move))

                    let allValid = this.getlms().filter((testmove) => testmove.roughlyequalto(move))

                    if(valid){
                        this.handleValidMoveInput(valid, allValid)
                    }else{
                        this.draw()
                    }                       
                    break
            }
        }
    }

    clearAwaitSquareClick(){
        this.awaitSquareClick = false
        this.inputtedMove = null
        this.nudgeMove = null
        this.nudgeMoves = []
        this.promotionPieces = null
        this.mouseClickDiv.disp("none")
    }

    positionchanged(){
        this.clearAwaitSquareClick()

        this.draw()

        if(this.positionchangedcallback) this.positionchangedcallback()
    }

    doflip(){
        this.g.flip = !this.g.flip        
        this.positionchanged()
    }

    fasq(sq){
        if(this.g.flip) return Square(LAST_SQUARE - sq.file, LAST_SQUARE - sq.rank)
        return sq
    }

    boardsize(){
        return this.squaresize * NUM_SQUARES
    }

    setgame(game){
        this.game = game        
        this.positionchanged()
        try{
            this.parentApp.pgnHeadersEditableList.fromOrderedHash(this.g.pgnHeaders)
        }catch(err){}        
        return this
    }

    squarelight(sq){return ( ( sq.file + sq.rank ) % 2 ) == 0}

    piecemargin(){return ( this.squaresize - this.piecesize() ) / 2}

    squarecoords(sq){
        return Vect(sq.file * this.squaresize, sq.rank * this.squaresize)
    }

    fasquarecoords(sq){
        return this.squarecoords(this.fasq(sq))
    }

    piececoords(sq){
        let sc = this.fasquarecoords(sq)
        return Vect(sc.x + this.piecemargin(), sc.y + this.piecemargin())
    }

    getCanvasByName(name){
        return this.canvases[this.canvasnames.findIndex(canvasName => name == canvasName)]
    }

    drawSquares(){        
        let backgroundcanvas = this.getCanvasByName("background")

        backgroundcanvas.loadBackgroundImage(`resources/client/img/backgrounds/${getLocal("app/ubertabpane/boardBackgroundCombo", {selected: DEFAULT_BOARD_BACKGROUND}).selected}`, Vect(this.boardsize(), this.boardsize()))

        let squarecanvas = this.getCanvasByName("square").op(this.squareopacity)
        
        for(let sq of ALL_SQUARES){
            squarecanvas.fillStyle(this.squarelight(sq) ? "#eed" : "#aab")
            let sqcoords = this.squarecoords(sq)
            squarecanvas.fillRect(sqcoords, Vect(this.squaresize, this.squaresize))
        }        
    }

    piecesize(){return this.squaresize * 0.85}

    drawPiece(canvas, coords, pOrig, scaleFactorOpt, rotateOpt){             
        if(pOrig.kind == "x"){
            canvas.fillStyle("#f00")
            canvas.fillRect(coords, Vect(this.piecesize(), this.piecesize()))
            return
        }

        let scaleFactor = scaleFactorOpt || 1
        let rotate = rotateOpt || 0
        let p = Piece(pOrig.kind, pOrig.color, pOrig.direction)
        let addKnight = false
        let addCircle = false
        let knightScaleFactor = 0.7
        if(p.kind == "e"){
            p.kind = "r"
            addKnight = true
        }
        if(p.kind == "h"){
            p.kind = "b"
            addKnight = true
        }
        if(p.kind == "j"){
            p.kind = "r"
            addCircle = true
        }
        if(p.kind == "s"){
            p.kind = "b"
            addCircle = true
        }
        if(p.kind == "l"){            
            p.kind = "n"            
            rotate = p.direction.angle()
            if(this.g.flip) rotate = rotate - Math.PI
        }
        let drawImgFunc = (piece, canvas, img, coords, scaleFactor, addKnight, addCircle, rotate) => {
            let size = this.piecesize() * scaleFactor
            let middle = coords.p(Vect(size / 2, size / 2))
            canvas.ctx.save()
            canvas.ctx.translate(middle.x, middle.y)
            canvas.ctx.rotate(rotate)
            canvas.ctx.translate(-middle.x, -middle.y)
            canvas.ctx.drawImage(img.e, coords.x, coords.y, size, size)
            if(addKnight){
                this.drawPiece(canvas, coords, Piece("n", p.color), knightScaleFactor)
            }            
            if(addCircle){
                Math.floor(canvas.lineWidth(this.squaresize / 10)) + 1
                canvas.strokeStyle(p.color ? "#00f" : "#f00")
                canvas.strokeCircle(middle, this.squaresize / 10)                            
            }            
            if(piece.kind == "l"){                
                canvas.arrow(
                    middle,
                    middle.p(Vect(-this.squaresize / 2, 0)),
                    {
                        scalefactor: this.arrowscalefactor(),
                        auxscalefactor: 0.4,
                        color: piece.color ? "#00f" : "#f00"
                    }
                )
            }
            canvas.ctx.restore()            
        }
        const klasssel = "." + getclassforpiece(p, this.piecestyle)                                                    
        let img
        if(!this.imgcache) this.imgcache = {}
        if(this.imgcache[klasssel]){
            img = this.imgcache[klasssel]
            drawImgFunc(pOrig, canvas, img, coords, scaleFactor, addKnight, addCircle, rotate)            
        }else{
            let style = getStyle(klasssel)            
            let imgurl = style.match(/url\("(.*?)"/)[1]                
            let imgurlparts = imgurl.split(",")
            let svgb64 = imgurlparts[1]
            let svg = atob(svgb64)
            let newsvg = svg.replace(/^<svg/, `<svg width="${this.piecesize()}" height="${this.piecesize()}"`)
            let newsvgb64 = btoa(newsvg)
            let newimgurl = imgurlparts[0] + "," + newsvgb64            
            let img = Img({width: this.piecesize(), height: this.piecesize()})                            
            let fen = this.g.fen()
            img.e.onload = () => {
                if(this.g.fen() == fen){
                    drawImgFunc(pOrig, canvas, img, coords, scaleFactor, addKnight, addCircle, rotate)            
                }                
                this.imgcache[klasssel] = img                
            }
            img.e.src = newimgurl                                                        
        }   
    }

    drawPieces(){                        
        let piececanvas = this.getCanvasByName("piece")
        piececanvas.clear()
        for(let sq of ALL_SQUARES){
            let p = this.b.pieceatsquare(sq)
            if(!p.isempty()){                
                let pc = this.piececoords(sq)
                this.drawPiece(piececanvas, pc, p)
            }
        }
    }

    arrowscalefactor(){
        return this.boardsize() / 560
    }

    drawmovearrow(canvas, move, argsopt){
        canvas.arrow(
            this.squaremiddlecoords(move.fromsq),
            this.squaremiddlecoords(move.tosq),
            argsopt
        )
    }

    clearanalysisinfo(){
        if(this.analysisinfoDiv) this.analysisinfoDiv.x()
        let analysiscanvas = this.getCanvasByName("analysis")
        analysiscanvas.clear()
        let sac = this.getCanvasByName("showanalysis")
        sac.clear()
        return analysiscanvas
    }

    squaremiddlecoords(sq){
        return Vect(this.fasq(sq).file, this.fasq(sq).rank).s(this.squaresize).p(Vect(this.squaresize/2, this.squaresize/2))
    }

    analysiskey(){        
        return `analysis/${this.g.variant}/${strippedfen(this.getcurrentnode().fen)}`
    }

    getcurrentnode(){
        return this.g.getcurrentnode()
    }
    
    createAnalysisInfoItemMove(item, lastcompleteddepth){
        return div().bdrs("solid").bdrw(this.getcurrentnode().hasSan(item.san) ? 2 : 0)
            .mar(1).pad(1).dfc()
            .c(scoretorgb(item.scorenumerical))
            .a(
                div()
                    .pad(1).ww(140)
                    .html(item.san).fs(26).fwb().cp()
                    .ae("mousedown", this.parentApp.moveClicked.bind(this.parentApp, item.detailedmove)),
                div()
                    .pad(1).ww(100).cp()                    
                    .html(`${item.scorenumerical}`).fs(22).fwb()
                    .ae("mousedown", this.parentApp.addLegalMove.bind(this.parentApp, item.detailedmove, 0)),
                div()
                    .c("#00a").fwb().cp()
                    .html(`${lastcompleteddepth}`)
                    .ae("mousedown", this.parentApp.addLegalMove.bind(this.parentApp, item.detailedmove, 1)),
            )
    }

    createAnalysisInfoItemLine(item){
        return div()
            .w(2000).dfc().flwn()
            .marl(10).ffm().fs(14)
            .a(
                item.pvsans.slice(1).map(san =>
                    div()
                        .c("#33a").bc("#ddd")
                        .marr(8).html(san)
                )
            )
    }

    createAnalysisInfoItem(item, lastcompleteddepth){
        return div()
            .marl(5)
            .a(
                this.createAnalysisInfoItemMove(item, lastcompleteddepth),
                this.createAnalysisInfoItemLine(item),
            )
    }

    createAnalysisInfoSummary(richanalysisinfo){
        let items = richanalysisinfo.analysisinfo.summary.map(item =>
            this.createAnalysisInfoItem(item, richanalysisinfo.analysisinfo.lastcompleteddepth))
        return div().a(
            div().df().jc("space-between").a(
                Button("Minimax", this.parentApp.minimax.bind(this.parentApp, false)).marl(10).w(130).padl(20).padr(20).mart(2).acs("button green"),
                Button("Unminimax", this.parentApp.clearMinimax.bind(this.parentApp, true)).marl(5).marr(10).mart(2).acs("button red"),
            ),
            items
        )
    }

    highlightrichanalysisinfo(richanalysisinfo){        
        let analysisinfo = richanalysisinfo.analysisinfo        
        let analysiscanvas = this.clearanalysisinfo()        
        if(this.parentApp.trainOn) return
        if(analysisinfo.analysiskey != this.analysiskey()) return
        let i = analysisinfo.summary.length        
        for(let item of analysisinfo.summary.slice().reverse()){
            this.drawmovearrow(analysiscanvas, item.move, {
                scalefactor: this.arrowscalefactor(),
                auxscalefactor: 1/i--,
                color: scoretorgb(item.scorenumerical)
            })      
        }

        try{
            if(this.parentApp.settings.showAnalysisInBoardCheckbox.checked && this.parentApp.shouldGo){                    
                let sac = this.getCanvasByName("showanalysis")

                sac.setFont(`${this.squaresize * 3}px serif`)

                let scorenumerical = analysisinfo.summary[0].scorenumerical

                sac.ctx.globalAlpha = 0.5

                sac.fillStyle(scoretorgb(scorenumerical))                
                
                sac.fillText(`${scorenumerical > 0 ? "+" + scorenumerical : scorenumerical}`, Vect(this.boardsize()/16, this.boardsize()/2))

                sac.setFont(`${this.squaresize * 2}px serif`)

                sac.fillStyle("#0000FF")                

                sac.fillText(`${analysisinfo.lastcompleteddepth}`, Vect(0.6 * this.boardsize(), 0.8 * this.boardsize()))
            }
        }catch(err){}

        if(this.analysisinfoDiv){
            this.analysisinfoDiv
            .bc(richanalysisinfo.isLive ? "#afa" : "#eee")
            .a(                
                this.createAnalysisInfoSummary(richanalysisinfo),
                richanalysisinfo.isLive ? div() :
                    Button("Delete", this.parentApp.deleteAnalysis.bind(this.parentApp))
                        .mart(20).marl(210).bc(RED_BUTTON_COLOR),
            )
        }
    }

    createCommentCanvas(){
        let bs = this.boardsize()

        this.commentcanvas = Canvas({width: bs, height: bs})

        this.commentcanvas.ctx.globalAlpha = 1

        this.commentcanvas.ctx.textBaseline = "top"
        this.commentcanvas.ctx.fillStyle = "#000000"

        this.commentfontsize = bs / 12
        this.commentmargin = this.commentfontsize / 3

        this.commentcanvas.ctx.font = `${this.commentfontsize}px serif`

        let message = this.getcurrentnode().comment.split("#")[0]
        if(message) this.commentcanvas.renderText(message, bs - 2 * this.commentmargin, this.commentfontsize * 1.1, this.commentmargin, this.commentmargin)
    }

    highlightLastMove(){
        try{
            this.highlightLastMoveInner()
        }catch(err){}
    }

    highlightLastMoveInner(){
        if(this.props.nohighlight) return
        let currentnode = this.getcurrentnode()
        let highlightcanvas = this.getCanvasByName("highlight")
        highlightcanvas.clear()        
        if(currentnode.genalgeb){                               
            let testb = ChessBoard().setfromfen(currentnode.getparent().fen, this.g.variant)
            let move = testb.algebtomove(currentnode.genalgeb)                                                
            let fromp = testb.pieceatsquare(move.fromsq)
            let top = testb.pieceatsquare(move.tosq)
            let sounds = [PIECE_LETTER_TO_SOUND[fromp.letter()]]
            if(!top.isempty()){
                sounds.push("explosion")
            }            
            if(this.b.iskingincheck(this.b.turn)){
                sounds.push("foghorn")
            }
            if(fromp.kind){
                let delay = 0
                for(let sound of sounds){                
                    let allowed = true
                    try{                    
                        if(this.parentApp.settings.disablePieceSoundsCheckbox.checked) allowed = false                                        
                    }catch(err){}
                    try{                                        
                        if(this.parentApp.parentApp.settings.disablePieceSoundsCheckbox.checked) allowed = false
                    }catch(err){}
                    if(sound && allowed){
                        setTimeout(_ => document.getElementById(sound).play().then(
                            _ => {},
                            _ => {}
                        ), delay)
                            
                        delay += 1000
                    }                
                }
            }
            this.drawmovearrow(highlightcanvas, move, {
                scalefactor: this.arrowscalefactor()
            })
            if(move.promsq){
                this.drawmovearrow(highlightcanvas, Move(move.tosq, move.promsq), {
                    scalefactor: this.arrowscalefactor(),
                    color: "#0ff"
                })
            }
        }
    }

    highlightWeights(){
        let currentnode = this.getcurrentnode()
        let weightscanvas = this.getCanvasByName("weights")
        weightscanvas.clear()                
        if(this.parentApp.trainOn && (!this.forceWeights)) return
        this.forceWeights = false
        for(let child of currentnode.sortedchilds()){
            let move = this.b.movefromalgeb(child.genalgeb)
            if(child.priority){
                this.drawmovearrow(weightscanvas, move, {
                    scalefactor: this.arrowscalefactor(),
                    auxscalefactor: 1.4,
                    color: "#0ff",
                    opacity: 0.5
                })
            }
            this.drawmovearrow(weightscanvas, move, {
                scalefactor: this.arrowscalefactor(),
                auxscalefactor: 1.2,
                color: child.weights[1] == 1 ? "#f00" : "#770",
                opacity: child.weights[1] == 1 ? 0.5 : child.weights[1] / 10
            })
            this.drawmovearrow(weightscanvas, move, {
                scalefactor: this.arrowscalefactor(),
                auxscalefactor: 1.2,
                color: "#00f",
                opacity: child.weights[0] / 10
            })
        }
    }

    highlightCheck(){        
        let wk = this.b.whereisking(this.b.turn)
        if(wk){
            if(this.b.iskingincheck(this.b.turn)){
                let coords = this.fasquarecoords(wk)
                let canvas = this.getCanvasByName("check")
                canvas.fillStyle("#f33")
                canvas.fillRect(coords, Vect(this.squaresize, this.squaresize))
            }
        }
    }

    draw(){
        this.getCanvasByName("dragpiece").clear()
        this.getCanvasByName("clicksquare").clear()
        this.getCanvasByName("check").clear()

        this.drawSquares()

        this.highlightCheck()

        this.highlightLastMove()

        this.highlightWeights()

        this.drawPieces()

        this.highlightDrawings()

        this.createCommentCanvas()

        this.drawResult()

        if(this.props.squareClickCallback){
            this.getCanvasByName("check").clear()
        }
    }

    drawResult(){
        this.resultDiv.x()
        if(this.g.terminated && (!this.g.playerSeatedAfterTermination)){
            this.resultDiv.a(
                div().dfc().pad(10).bc("#ffa").fs(this.squaresize/3).a(
                    PlayersLabel(this.g)
                ),
                div().pad(10).bc("#ffa").fs(this.squaresize).html(this.g.resultVerbal()),
                div().fst("italic").pad(10).bc("#ffa").fs(this.squaresize/3).html(this.g.resultReason)
            )
        }
    }

    tobegin(){
        this.g.tobegin()
        this.positionchanged()
    }

    back(){
        this.g.back()
        this.positionchanged()
    }

    forward(){
        let fw = this.g.forward()
        this.positionchanged()
        return fw
    }

    toend(){
        this.g.toend()
        this.positionchanged()
    }

    del(){
        this.g.del()
        this.positionchanged()
    }

    setfromnode(node){
        this.g.setfromnode(node)
        this.positionchanged()
    }

    calcdrawingstyle(r,g,b,o){
        return `rgb(${r},${g},${b},${(o+1)/10})` 
    }

    getdrawingcolor(drawing){
        return {
            red: this.calcdrawingstyle(255,0,0,drawing.opacity),
            green: this.calcdrawingstyle(0,127,0,drawing.opacity),
            blue: this.calcdrawingstyle(0,0,255,drawing.opacity),
            yellow: this.calcdrawingstyle(192,192,0,drawing.opacity)
        }[drawing.color]
    }

    calcdrawingsize(size){
        return size * this.squaresize / 60
    }

    highlightDrawings(){        
        let drawings = this.getcurrentnode().drawings()        
        let drawingscanvas = this.getCanvasByName("drawings")
        drawingscanvas.clear()
        let b = this.b
        for(let drawing of drawings){                     
            try{
                let squares = drawing.squares.map(algeb => this.fasq(b.algebtosquare(algeb)))
                switch(drawing.kind){
                    case "circle":                                        
                        for(let sq of squares){                            
                            let sqmc = this.squaremiddlecoords(this.fasq(sq))
                            drawingscanvas.lineWidth(this.calcdrawingsize(drawing.thickness))
                            drawingscanvas.strokeStyle(this.getdrawingcolor(drawing))
                            drawingscanvas.strokeCircle(sqmc, this.squaresize / 2.5)                            
                        }
                        break
                    case "arrow":
                        for(let i=0;i<squares.length/2;i++){
                            let move = Move(this.fasq(squares[i*2]), this.fasq(squares[i*2+1]))                                                        
                            this.drawmovearrow(drawingscanvas, move, {
                                color: this.getdrawingcolor(drawing),
                                auxscalefactor: drawing.thickness / 5
                            })
                        }
                        break
                    case "square":                                        
                        drawing.opacity /= 2
                        for(let sq of squares){
                            let sqc = this.squarecoords(sq)
                            drawingscanvas.fillStyle(this.getdrawingcolor(drawing))
                            drawingscanvas.fillRect(sqc.p(Vect(this.piecemargin(), this.piecemargin())), Vect(this.piecesize(), this.piecesize()))
                        }
                        break
                }
            }catch(err){
                console.log(err)
            }            
        }
    }
}
function Board(props){return new Board_(props)}

class SetupBoard_ extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.parentApp = this.props.parentApp
    }

    setRestFen(){
        let restfen = this.posBoard.b.fen.split(" ").slice(1).join(" ")
        this.restfeninput.setValue(restfen)
    }

    setCurrentPosition(){
        let pg = Game().fromblob(this.parentApp.g.serialize())
        this.posBoard.setgame(pg)

        this.setRestFen()
        this.rawfeninput.setValue(this.posBoard.b.reportRawFen())        
    }

    posboardClicked(clickedsq){
        if(!this.setupPiece){
            if(this.posBoard.b.pieceatsquare(clickedsq).isempty()){
                this.parentApp.alert("Select a piece to set from the right board .", "error")
            }else{
                this.posBoard.b.setpieaceatsquare(clickedsq, Piece())                
            }                        
        }else{
            if(this.posBoard.b.pieceatsquare(clickedsq).isempty()){
                this.posBoard.b.setpieaceatsquare(clickedsq, this.setupPiece)
            }else{
                this.posBoard.b.setpieaceatsquare(clickedsq, Piece())                
            }                        
        }
        this.posBoard.draw()
        this.rawfeninput.setValue(this.posBoard.b.reportRawFen())        
    }

    pieceboardClicked(clickedsq){
        this.setupPiece = this.pieceBoard.b.pieceatsquare(clickedsq)
    }

    setGameFromThisFen(){
        let fen = this.rawfeninput.value() + " " + this.restfeninput.value()

        this.parentApp.resetFromFen(fen)
    }

    clearPosition(){
        this.posBoard.b.setfromfen(CLEAR_FEN)
        this.posBoard.draw()
        this.rawfeninput.setValue(this.posBoard.b.reportRawFen())        
    }

    init(){        
        this.a(
            div().dfcc().a(div().dib().tac().pad(3).bc("#aaa").a(
                Button("Set current position", this.setCurrentPosition.bind(this)).bc(GREEN_BUTTON_COLOR),
                Button("Clear", this.clearPosition.bind(this)).bc(RED_BUTTON_COLOR),
                Button("Set game from this fen", this.setGameFromThisFen.bind(this)).bc(YELLOW_BUTTON_COLOR),
                div().dfc().ffm().a(
                    this.rawfeninput = TextInput().w(480).pad(3),
                    this.restfeninput = TextInput().w(300).pad(3),
                )                
            ),
            div().mart(3).dib().pad(3).bc("#ddd").a(div().dfc().am(
                this.posBoard = Board({
                    id: "posboard",
                    parentApp: this,
                    nohighlight: true,
                    squareClickCallback: this.posboardClicked.bind(this),
                    squaresize: this.props.squaresize || DEFAULT_SQUARESIZE                    
                }),
                this.pieceBoard = Board({
                    id: "pieceboard",
                    parentApp: this,
                    nohighlight: true,
                    squareClickCallback: this.pieceboardClicked.bind(this),
                    squaresize: this.props.squaresize || DEFAULT_SQUARESIZE
                }).marl(5)
            )))
        )

        let sg = Game().setfromfen(SETUP_FEN)
        this.pieceBoard.setgame(sg)

        this.setCurrentPosition()
    }
}
function SetupBoard(props){return new SetupBoard_(props)}
