const uploadInput = document.getElementById("upload");
const downloadButton = document.getElementById("download-button");
const blockSizeInput = document.getElementById("block-size-input");
const controls = document.getElementById("controls");
const outputOptions = document.getElementById("output-options");
const divisor = document.getElementById("divisor");
const slider = document.getElementById("slider");
const comparison = document.getElementById("comparison");
// const startProjectButton = document.getElementById("start-project-button");
const saveProjectButton = document.getElementById("save-project");
const deleteProjectButtons = document.querySelectorAll(".delete-project");
// const viewSavedProjectsButton = document.getElementById("view-saved-projects-button");
const paletteSizeSelect = document.getElementById("palette-size-select");
const openSketchButton = document.getElementById("open-sketch")

let originalImage = null;
let originalImageURL = null;
let editedImageURL = null;
let originalBlob = null;
let editedBlob = null;
let projectId = null;
let originalFileName = "";
let estimatedBlockSize = 8;
let estimatedTolerance = 30;
const toggleColorChangeMapButton = document.getElementById("toggle-color-change-map-button");
let isColorChangeMapVisible = false;
let colorChangePositions = [];

function calculateColorChanges(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const changes = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            if (x > 0) {
                const prevIndex = (y * width + x - 1) * 4;
                if (
                    colorsAreDifferent(
                        data.slice(index, index + 3),
                        data.slice(prevIndex, prevIndex + 3),
                        estimatedTolerance
                    )
                ) {
                    changes.push({ x, y });
                }
            }
            if (y > 0) {
                const prevIndex = ((y - 1) * width + x) * 4;
                if (
                    colorsAreDifferent(
                        data.slice(index, index + 3),
                        data.slice(prevIndex, prevIndex + 3),
                        estimatedTolerance
                    )
                ) {
                    changes.push({ x, y });
                }
            }
        }
    }
    return changes;
}

function drawColorChangeMap(img, changes) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = "red";
    changes.forEach(({ x, y }) => {
        ctx.fillRect(x, y, 1, 1); // mark color change red
    });

    const overlay = document.querySelector("#comparison figure");
    overlay.style.backgroundImage = `url(${canvas.toDataURL()})`;
}

toggleColorChangeMapButton?.addEventListener("click", async () => {
    const overlay = document.querySelector("#comparison figure");
    if (!isColorChangeMapVisible) {
        const img = new Image();
        img.src = originalImageURL;
        img.onload = () => {
            if (!colorChangePositions.length) {
                colorChangePositions = calculateColorChanges(img);
            }
            drawColorChangeMap(img, colorChangePositions);
            toggleColorChangeMapButton.textContent = "Hide Color Change Map";
            isColorChangeMapVisible = true;
        };
    } else {
        overlay.style.backgroundImage = `url(${originalImageURL})`;
        toggleColorChangeMapButton.textContent = "Show Color Change Map";
        isColorChangeMapVisible = false;
    }
});

window.addEventListener('resize', () => {
    const editorMain = document.getElementById("editor");
    if (editorMain) {
        setupSnappedImage(editedImageURL);
        console.log('resize');
    }
});

function setupOriginalImage(url, imgElement) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.width / img.height;
            comparison.style.aspectRatio = `${aspectRatio}`;
            imgElement.style.backgroundImage = `url(${url})`;
            originalImageURL = url;
            resolve();
        };
        img.onerror = () => {
            console.error("Error loading image:", url);
            reject(new Error("Failed to load image"));
        };
        img.src = url; // start image load
    });
}

function setupSnappedImage(editedImageURL) {
    divisor.style.backgroundImage = `url(${editedImageURL})`;
    const comparisonRect = comparison.getBoundingClientRect();
    divisor.style.backgroundSize = `${comparisonRect.width}px ${comparisonRect.height}px`;
    divisor.style.backgroundRepeat = "no-repeat";
    divisor.style.backgroundPosition = "top left";
    downloadButton.classList.remove("hidden");
    saveProjectButton.classList.remove("hidden");
    toggleColorChangeMapButton.classList.remove("hidden")
}

function populateBlockValue(img) {
    const blockSize = estimateBlockSize(img);
    blockSizeInput.value = blockSize;
    return blockSize;
}

async function deleteProject(click) {
    console.log("delete commencing");
    const deleteProjectButton = click.target;
    const project = deleteProjectButton.closest(".project-card");
    projectID = project.getAttribute("data-id");
    try {
        const response = await fetch(`/projects/${projectID}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
            window.location.reload();
        }
    } catch (error) {
        console.error("Error deleting project:", error);
    }
}

uploadInput?.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    openSketchButton.classList.remove("hidden");
    const getStartedText = document.getElementById("get-started");
    getStartedText.style.display = "none";
    // reset data attributes
    const editorMain = document.getElementById("editor");
    editorMain.setAttribute("data-project-id", "");
    editorMain.setAttribute("data-original-image", "");
    editorMain.setAttribute("data-block-size", "");
    editorMain.setAttribute("data-palette-size", "");

    // reset UI
    originalFileName = file.name.split(".")[0];
    projectId = null;
    editedImageURL = null;
    isColorChangeMapVisible = false;
    toggleColorChangeMapButton.textContent = "Show Color Change Map";
    colorChangePositions = [];
    divisor.style.backgroundImage = "";
    paletteSizeSelect.value = "";
    downloadButton.classList.add("hidden");
    saveProjectButton.classList.add("hidden");

    // load new image as object url
    const objectURL = URL.createObjectURL(file);
    originalBlob = await fetch(objectURL).then((res) => res.blob());
    await setupOriginalImage(objectURL, document.querySelector("#comparison figure"));

    // convert to data url
    const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // store data url in local storage
    localStorage.setItem("editedImage", dataURL);
    console.log('LocalStorage updated with edited image after upload');

    const img = new Image();
    img.onload = async () => {
        controls.classList.remove("hidden");
        outputOptions.classList.remove("hidden");
        comparison.classList.remove("hidden");

        // estimate and update block size
        const blockSize = populateBlockValue(img);
        blockSizeInput.value = blockSize;
        localStorage.setItem("blockSize", blockSize);
        console.log(`LocalStorage updated with block size: ${blockSizeInput.value} after upload`);

        // auto-snap image to grid
        await snapToGrid(blockSize);
        downloadButton.classList.remove("hidden");
        saveProjectButton.classList.remove("hidden");
        openSketchButton.classList.remove("hidden");
    };

    img.src = objectURL;
});

// Open sketch from sketch ID button in editor
openSketchButton?.addEventListener("click", () => {
    if (openSketchButton.getAttribute("href") === "#") {
        window.location.href = "/sketch/new";
    }
});

saveProjectButton?.addEventListener("click", async () => {
    const formData = new FormData();
    formData.append("original_image", new File([originalBlob], "original.png"));
    formData.append("edited_image", new File([editedBlob], "edited.png"));
    formData.append("block_size", blockSizeInput.value);
    formData.append("palette_size", paletteSizeSelect.value);
    if (projectId) formData.append("project_id", projectId);
    try {
        const response = await fetch("/projects", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error("Failed to save the project");
        }
        const result = await response.json();
        if (result.project_id) {
            console.log("Project saved successfully:", result);
            projectId = result.project_id; // update id for later saves
        } else {
            console.error("Invalid response: missing project ID");
        }
    } catch (error) {
        console.error("Error saving the project:", error);
    }
});

blockSizeInput?.addEventListener("input", blockSizeChange);


async function blockSizeChange() {
    const userBlockSize = parseInt(blockSizeInput.value, 10) || estimatedBlockSize;
    try {
        await snapToGrid(userBlockSize);
        paletteSizeChange();
        downloadButton.classList.remove("hidden");
        saveProjectButton.classList.remove("hidden");
        localStorage.setItem("blockSize", userBlockSize);
        console.log(`LocalStorage updated with new block size: ${userBlockSize}`);
    } catch (error) {
        console.error("Error during snapping or palette size change:", error);
    }
}

downloadButton?.addEventListener("click", () => {
    if (editedImageURL) {
        const link = document.createElement("a");
        link.href = editedImageURL;
        link.download = `piksul_${originalFileName}.png`;
        link.click();
    }
});
deleteProjectButtons?.forEach((button) =>
    button.addEventListener("click", deleteProject)
);

slider?.addEventListener("input", () => {
    divisor.style.width = slider.value + "%";
});

document.addEventListener("DOMContentLoaded", async () => {
    const yearElement = document.getElementById("year");
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    // Set up editor after open project is clicked in gallery
    const editorMain = document.getElementById("editor");
    const gallery = document.getElementById("gallery");
    if (editorMain) {
        projectId = editorMain.dataset.projectId;
        console.log({ projectId });
        const originalImageFilename = editorMain.dataset.originalImage;
        const blockSize = editorMain.dataset.blockSize;
        const paletteSize = editorMain.dataset.paletteSize;
        
        if (projectId && originalImageFilename) {
            const imagePath = `/gallery/image/${originalImageFilename}`;
            const getStartedText = document.getElementById("get-started");
            getStartedText.style.display = "none";
            openSketchButton.classList.remove("hidden");
            try {
                // fetch original image as blob
                const response = await fetch(imagePath);
                if (!response.ok) {
                    throw new Error("Failed to fetch original image");
                }
                originalBlob = await response.blob();

                // load image into the editor
                await setupOriginalImage(imagePath, document.querySelector("#comparison figure"));
                controls.classList.remove("hidden");
                outputOptions.classList.remove("hidden");
                comparison.classList.remove("hidden");

                // populate block size
                blockSizeInput.value = blockSize;
                paletteSizeSelect.value = paletteSize;
                localStorage.setItem("editedImage", imagePath);
                localStorage.setItem("blockSize", blockSize);
                localStorage.setItem("paletteSize", paletteSize);
                console.log(`LocalStorage initialized from gallery project." Block size: ${blockSizeInput.value}, Palette Size ${paletteSizeSelect.value}`);
                blockSizeChange();
            } catch (error) {
                console.error("Error during editor setup:", error);
            }
        }
    }
    if(gallery) {
        const openSketchButtons = document.querySelectorAll('.project-buttons .open-sketch');          
        openSketchButtons.forEach(button => {
            button.addEventListener('click', (e) => {        
            const projectCard = button.closest('.project-card');
            if (!projectCard) return;
            const projectId = projectCard.dataset.id;
            const blockSize = projectCard.dataset.blockSize;
            const paletteSize = projectCard.dataset.paletteSize;
            const editedImage = projectCard.dataset.editedImage;
            const imagePath = `/gallery/image/${editedImage}`;
            localStorage.setItem("editedImage", imagePath);
            localStorage.setItem("blockSize", blockSize);
            localStorage.setItem("paletteSize", paletteSize);
            window.location.href = `/sketch/${projectId}`;
            });
        });
    }
});

paletteSizeSelect?.addEventListener("change", paletteSizeChange);

function paletteSizeChange() {
    const paletteSize = parseInt(paletteSizeSelect.value, 10);
    localStorage.setItem("paletteSize", paletteSize);
    console.log(`LocalStorage updated with palette size: ${paletteSize}`);
    if (isNaN(paletteSize)) {
        // if none selected, reset to regular snapped image
        if (snappedImageURL) {
            editedImageURL = snappedImageURL;
            setupSnappedImage(editedImageURL);
            localStorage.setItem("editedImage", editedImageURL);
            console.log(`LocalStorage updated with edited image (no quantization)`);
        } else {
            console.warn("No snapped image to reset to.");
        }
    } else {
        applyQuantizationToImage(paletteSize);
    }
}

// CALCULATIONS
function estimateBlockSize(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

    // Gradient-profile autocorrelation for initial period estimate
    function getLuma(x, y) {
        const i = (y * width + x) * 4;
        return data[i+3] === 0 ? 255 : 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
    }
    const colGrad = new Float64Array(width);
    const rowGrad = new Float64Array(height);
    for (let y = 0; y < height; y++)
        for (let x = 1; x < width-1; x++)
            colGrad[x] += Math.abs(getLuma(x+1,y) - getLuma(x-1,y));
    for (let x = 0; x < width; x++)
        for (let y = 1; y < height-1; y++)
            rowGrad[y] += Math.abs(getLuma(x,y+1) - getLuma(x,y-1));

    function smooth5(arr) {
        const out = new Float64Array(arr.length);
        const w = [0.5, 1, 2, 1, 0.5];
        for (let i = 0; i < arr.length; i++) {
            let v = 0;
            for (let k = -2; k <= 2; k++) v += w[k+2] * arr[Math.max(0, Math.min(arr.length-1, i+k))];
            out[i] = v / 5;
        }
        return out;
    }
    function autocorrPeak(profile, minLag, maxLag) {
        const n = profile.length;
        const mean = profile.reduce((a, b) => a+b, 0) / n;
        const centered = profile.map(v => v - mean);
        const denom = centered.reduce((a, v) => a+v*v, 0);
        if (denom === 0) return minLag;
        let bestLag = minLag, bestCorr = -Infinity;
        for (let lag = minLag; lag <= maxLag; lag++) {
            let num = 0;
            for (let i = lag; i < n; i++) num += centered[i] * centered[i-lag];
            const corr = num / denom;
            if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
        }
        return bestLag;
    }
    const xPeriod = autocorrPeak(smooth5(colGrad), 4, Math.min(256, Math.floor(width/3)));
    const yPeriod = autocorrPeak(smooth5(rowGrad), 4, Math.min(256, Math.floor(height/3)));
    const initEstimate = Math.min(xPeriod, yPeriod);
    console.log(`BlockSize autocorr: x=${xPeriod}, y=${yPeriod} → estimate=${initEstimate} (min)`);

    // 2D prefix sums (shared across all candidate block sizes)
    const stride = width + 1, psLen = stride * (height + 1);
    const sR=new Float64Array(psLen), sG=new Float64Array(psLen), sB=new Float64Array(psLen);
    const sR2=new Float64Array(psLen), sG2=new Float64Array(psLen), sB2=new Float64Array(psLen);
    for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
            const pi=((y-1)*width+(x-1))*4, r=data[pi], g=data[pi+1], b=data[pi+2];
            const i=y*stride+x, t=(y-1)*stride+x, l=y*stride+(x-1), tl=(y-1)*stride+(x-1);
            sR[i]=r+sR[t]+sR[l]-sR[tl]; sG[i]=g+sG[t]+sG[l]-sG[tl]; sB[i]=b+sB[t]+sB[l]-sB[tl];
            sR2[i]=r*r+sR2[t]+sR2[l]-sR2[tl]; sG2[i]=g*g+sG2[t]+sG2[l]-sG2[tl]; sB2[i]=b*b+sB2[t]+sB2[l]-sB2[tl];
        }
    }
    function q(s, x1, y1, x2, y2) { return s[y2*stride+x2]-s[y2*stride+x1]-s[y1*stride+x2]+s[y1*stride+x1]; }
    // Character-only variance: skip near-white background blocks (mean luma > 210)
    const BG_THRESH = 210;
    function rawScore(bs, xo, yo) {
        const nbX=Math.floor((width-xo)/bs), nbY=Math.floor((height-yo)/bs), n=bs*bs;
        let total=0, count=0;
        for (let by=0;by<nbY;by++) for (let bx=0;bx<nbX;bx++) {
            const x1=xo+bx*bs, y1=yo+by*bs, x2=x1+bs, y2=y1+bs;
            const mr=q(sR,x1,y1,x2,y2)/n, mg=q(sG,x1,y1,x2,y2)/n, mb=q(sB,x1,y1,x2,y2)/n;
            if (0.299*mr+0.587*mg+0.114*mb > BG_THRESH) continue;
            total+=q(sR2,x1,y1,x2,y2)/n-mr*mr+q(sG2,x1,y1,x2,y2)/n-mg*mg+q(sB2,x1,y1,x2,y2)/n-mb*mb;
            count++;
        }
        return { total, nbX, nbY, count };
    }
    function bestScoreForBS(bs) {
        const s00 = rawScore(bs, 0, 0).total;
        let best=s00, bxo=0, byo=0;
        for (let yo=0;yo<bs;yo++) for (let xo=0;xo<bs;xo++) {
            if (xo===0&&yo===0) continue;
            const s=rawScore(bs,xo,yo).total;
            if (s<best) { best=s; bxo=xo; byo=yo; }
        }
        const useOff = best < s00*0.95;
        const {count} = rawScore(bs, useOff?bxo:0, useOff?byo:0);
        return { score: useOff?best:s00, pixelCount: count*bs*bs };
    }

    // Rank candidates by character-only per-pixel variance (no divisibility bonus)
    const candidates = new Set();
    for (let b=Math.max(4,initEstimate-3); b<=initEstimate+3; b++) candidates.add(b);
    for (let b=Math.max(4,initEstimate-6); b<=initEstimate+6; b++) {
        if (width%b===0 || height%b===0) candidates.add(b);
    }
    let bestB=initEstimate, bestPerPx=Infinity;
    for (const b of candidates) {
        const {score, pixelCount} = bestScoreForBS(b);
        const perPx = pixelCount>0 ? score/pixelCount : Infinity;
        if (perPx<bestPerPx) { bestPerPx=perPx; bestB=b; }
    }
    console.log(`BlockSize selected: ${bestB}`);
    return bestB;
}

function colorsAreDifferent(color1, color2, tolerance) {
    return (
        Math.abs(color1[0] - color2[0]) > tolerance ||
        Math.abs(color1[1] - color2[1]) > tolerance ||
        Math.abs(color1[2] - color2[2]) > tolerance
    );
}

let snappedImageURL = null;

function estimateGridOffset(imageData, blockSize) {
    const { data, width, height } = imageData;
    const stride = width + 1;
    const psLen = stride * (height + 1);

    // 2D prefix sums for R, G, B and their squares (for variance = E[X²] - E[X]²)
    const sR  = new Float64Array(psLen);
    const sG  = new Float64Array(psLen);
    const sB  = new Float64Array(psLen);
    const sR2 = new Float64Array(psLen);
    const sG2 = new Float64Array(psLen);
    const sB2 = new Float64Array(psLen);

    for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
            const pi = ((y - 1) * width + (x - 1)) * 4;
            const r = data[pi], g = data[pi + 1], b = data[pi + 2];
            const i  = y * stride + x;
            const t  = (y - 1) * stride + x;
            const l  = y * stride + (x - 1);
            const tl = (y - 1) * stride + (x - 1);
            sR[i]  = r   + sR[t]  + sR[l]  - sR[tl];
            sG[i]  = g   + sG[t]  + sG[l]  - sG[tl];
            sB[i]  = b   + sB[t]  + sB[l]  - sB[tl];
            sR2[i] = r*r + sR2[t] + sR2[l] - sR2[tl];
            sG2[i] = g*g + sG2[t] + sG2[l] - sG2[tl];
            sB2[i] = b*b + sB2[t] + sB2[l] - sB2[tl];
        }
    }

    function q(s, x1, y1, x2, y2) {
        return s[y2*stride+x2] - s[y2*stride+x1] - s[y1*stride+x2] + s[y1*stride+x1];
    }

    function scoreOffset(xo, yo) {
        const nbX = Math.floor((width  - xo) / blockSize);
        const nbY = Math.floor((height - yo) / blockSize);
        const n   = blockSize * blockSize;
        let total = 0;
        for (let by = 0; by < nbY; by++) {
            for (let bx = 0; bx < nbX; bx++) {
                const x1 = xo + bx * blockSize, y1 = yo + by * blockSize;
                const x2 = x1 + blockSize,      y2 = y1 + blockSize;
                const mr = q(sR,  x1, y1, x2, y2) / n;
                const mg = q(sG,  x1, y1, x2, y2) / n;
                const mb = q(sB,  x1, y1, x2, y2) / n;
                total += q(sR2, x1, y1, x2, y2) / n - mr * mr;
                total += q(sG2, x1, y1, x2, y2) / n - mg * mg;
                total += q(sB2, x1, y1, x2, y2) / n - mb * mb;
            }
        }
        return total;
    }

    const scoreAt00 = scoreOffset(0, 0);
    let bestScore = scoreAt00, bestXO = 0, bestYO = 0;

    for (let yo = 0; yo < blockSize; yo++) {
        for (let xo = 0; xo < blockSize; xo++) {
            if (xo === 0 && yo === 0) continue;
            const score = scoreOffset(xo, yo);
            if (score < bestScore) { bestScore = score; bestXO = xo; bestYO = yo; }
        }
    }

    const MARGIN = 0.05;
    const useOffset = bestScore < scoreAt00 * (1 - MARGIN);
    const xOffset = useOffset ? bestXO : 0;
    const yOffset = useOffset ? bestYO : 0;
    console.log(`Grid offset: best=(${bestXO},${bestYO}) score=${bestScore.toFixed(0)}, (0,0) score=${scoreAt00.toFixed(0)} → using (${xOffset},${yOffset})`);
    return { xOffset, yOffset };
}

async function snapToGrid(blockSize) {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.src = originalImageURL;
        img.onload = resolve;
        img.onerror = () => {
            console.error("Failed to load the original image for snapping.");
            reject(new Error("Failed to load the original image for snapping."));
        };
    });

    const srcCanvas = document.createElement("canvas");
    const srcCtx = srcCanvas.getContext("2d");
    srcCanvas.width = img.width;
    srcCanvas.height = img.height;
    srcCtx.drawImage(img, 0, 0);
    const imageData = srcCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    const srcWidth = img.width;
    const srcHeight = img.height;

    const { xOffset, yOffset } = estimateGridOffset(imageData, blockSize);

    const numBlocksX = Math.floor((srcWidth  - xOffset) / blockSize);
    const numBlocksY = Math.floor((srcHeight - yOffset) / blockSize);
    const cleanWidth  = numBlocksX * blockSize;
    const cleanHeight = numBlocksY * blockSize;

    console.log(`Snapping: blockSize=${blockSize}, offset=(${xOffset},${yOffset}), output=${cleanWidth}x${cleanHeight}`);

    const canvas = document.createElement("canvas");
    canvas.width = cleanWidth;
    canvas.height = cleanHeight;
    const ctx = canvas.getContext("2d");
    const outImageData = ctx.createImageData(cleanWidth, cleanHeight);
    const outData = outImageData.data;

    for (let blockY = 0; blockY < numBlocksY; blockY++) {
        for (let blockX = 0; blockX < numBlocksX; blockX++) {
            const srcX = xOffset + blockX * blockSize;
            const srcY = yOffset + blockY * blockSize;
            // Mode color: most frequent exact RGBA across all pixels in the block
            const colorCounts = new Map();
            for (let oy = 0; oy < blockSize; oy++) {
                for (let ox = 0; ox < blockSize; ox++) {
                    const px = Math.min(srcX+ox, srcWidth-1), py = Math.min(srcY+oy, srcHeight-1);
                    const si = (py*srcWidth+px)*4;
                    const key = `${data[si]},${data[si+1]},${data[si+2]},${data[si+3]}`;
                    colorCounts.set(key, (colorCounts.get(key)||0)+1);
                }
            }
            let modeKey = null, modeCount = 0;
            for (const [key, count] of colorCounts) {
                if (count > modeCount) { modeCount = count; modeKey = key; }
            }
            const [r, g, b, a] = (modeKey||'0,0,0,255').split(',').map(Number);

            const dstX = blockX * blockSize;
            const dstY = blockY * blockSize;
            for (let oy = 0; oy < blockSize; oy++) {
                for (let ox = 0; ox < blockSize; ox++) {
                    const dstIdx = ((dstY + oy) * cleanWidth + (dstX + ox)) * 4;
                    outData[dstIdx]     = r;
                    outData[dstIdx + 1] = g;
                    outData[dstIdx + 2] = b;
                    outData[dstIdx + 3] = a;
                }
            }
        }
    }

    ctx.putImageData(outImageData, 0, 0);
    snappedImageURL = canvas.toDataURL("image/png");
    editedImageURL = snappedImageURL;
    editedBlob = await fetch(editedImageURL).then((res) => res.blob());

    // Crop the original to the same region so the comparison slider aligns flush.
    // originalImageURL is kept intact for save/upload; only the overlay is updated.
    const croppedOrigCanvas = document.createElement("canvas");
    croppedOrigCanvas.width  = cleanWidth;
    croppedOrigCanvas.height = cleanHeight;
    croppedOrigCanvas.getContext("2d").drawImage(
        srcCanvas, xOffset, yOffset, cleanWidth, cleanHeight, 0, 0, cleanWidth, cleanHeight
    );
    document.querySelector("#comparison figure").style.backgroundImage =
        `url(${croppedOrigCanvas.toDataURL("image/png")})`;
    comparison.style.aspectRatio = `${cleanWidth / cleanHeight}`;

    setupSnappedImage(editedImageURL);
    localStorage.setItem("editedImage", editedImageURL);
    console.log(`LocalStorage updated with edited image after snapping`);
}

function applyQuantizationToImage(paletteSize) {
    if (!snappedImageURL) {
        console.error(
            "Snapped image not available. Please snap the image to the grid first."
        );
        return;
    }
    const img = new Image();
    img.src = snappedImageURL; // use unchangd snapped image
    img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        try {
            const rgbQuant = new RgbQuant({ colors: paletteSize });
            rgbQuant.sample(imageData.data);
            const reducedData = rgbQuant.reduce(imageData.data, 2);
            const palette = rgbQuant.palette(true); // get palette
            if (!palette || palette.length === 0) {
                console.error("RgbQuant failed to generate a palette.");
                return;
            }
            const reducedImageData = ctx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < reducedData.length; i++) {
                const paletteIndex = reducedData[i];
                const offset = i * 4;
                const alpha = imageData.data[offset + 3];

                if (alpha === 0) {
                    reducedImageData.data[offset] = 0;
                    reducedImageData.data[offset + 1] = 0;
                    reducedImageData.data[offset + 2] = 0;
                    reducedImageData.data[offset + 3] = 0; // transparent
                } else if (paletteIndex >= 0 && paletteIndex < palette.length) {
                    const color = palette[paletteIndex];
                    reducedImageData.data[offset] = color[0]; // r
                    reducedImageData.data[offset + 1] = color[1]; // g
                    reducedImageData.data[offset + 2] = color[2]; // Blbue
                    reducedImageData.data[offset + 3] = 255; // opaque
                } else {
                    reducedImageData.data[offset] =
                        reducedImageData.data[offset + 1] =
                        reducedImageData.data[offset + 2] =
                            0;
                    reducedImageData.data[offset + 3] = 255;
                }
            }

            ctx.putImageData(reducedImageData, 0, 0);
            editedImageURL = canvas.toDataURL("image/png"); // update quantized image url

            // update editedb blob after quantization
            editedBlob = await fetch(editedImageURL).then((res) => res.blob());
            setupSnappedImage(editedImageURL);
            localStorage.setItem("editedImage", editedImageURL);
            console.log('LocalStorage updated with edited image after quantization');
        } catch (err) {
            console.error("Error during quantization:", err);
        }
    };
    img.onerror = () => console.error("Failed to load the snapped image for quantization.");
}

