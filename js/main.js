var logTarget = document.getElementById('logTarget');

const NUM_PATTERNS = 16;
const NUM_TRACKS = 8;
const NUM_STEPS = 16;
const PITCHES = [1, 1.1, 1.25, 1.32, 1.5, 1.7, 1.9, 2];

var patternMatrix;


function Track(vol, pan, pitch, steps) {
    this.vol = vol;
    this.pan = pan;
    this.pitch = pitch;
    this.steps = steps;
}

function createTrackFromPatternMatrix(trackIdx, patternIdx) {
    let stepsArray = [];
    for (let stepIdx = patternIdx * NUM_STEPS; stepIdx < (patternIdx + 1) * NUM_STEPS; stepIdx++) {
        stepsArray.push(math.subset(patternMatrix, math.index(trackIdx, stepIdx)));
    }
    let track = new Track(1, 0, PITCHES[trackIdx], stepsArray);
    return track;
}

const strToComplexNum = function (complexStr) {
    // Delineation between real and imaginary parts is first sign (+/-) that isn't at the start of the string
    //console.log('complexStr: ' + complexStr);
    let minusSignPosition = complexStr.indexOf('-', 1);
    if (complexStr.charAt(minusSignPosition - 1) === 'e') {
        minusSignPosition = complexStr.indexOf('-', minusSignPosition + 1);
    }
    let plusSignPosition = complexStr.indexOf('+', 1);
    if (complexStr.charAt(plusSignPosition - 1) === 'e') {
        plusSignPosition = complexStr.indexOf('+', plusSignPosition + 1);
    }
    let imaginaryPositive = true;
    if (minusSignPosition > 0) {
        if (plusSignPosition < 0 || minusSignPosition < plusSignPosition) {
            imaginaryPositive = false;
        }
    }

    let realPartStr = "";
    let imagPartStr = "";

    if (imaginaryPositive) {
        // There should be a plus sign in the string
        realPartStr = complexStr.substring(0, plusSignPosition);
        imagPartStr = complexStr.substring(plusSignPosition);
    }
    else {
        // There should be a minus sign in the string
        realPartStr = complexStr.substring(0, minusSignPosition);
        imagPartStr = complexStr.substring(minusSignPosition);
    }
    if (imagPartStr.endsWith('j')) {
        imagPartStr = imagPartStr.substring(0, imagPartStr.indexOf('j'));
    }
    else if (imagPartStr.endsWith('i')) {
        imagPartStr = imagPartStr.substring(0, imagPartStr.indexOf('i'));
    }

    return math.complex(Number(realPartStr), Number(imagPartStr));
};


function performCutTextarea() {
    var hasSelection = document.queryCommandEnabled('cut');
    var cutTextarea = document.querySelector('.js-cuttextarea');
    cutTextarea.select();

    try {
        var successful = document.execCommand('cut');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Cutting text command was ' + msg);
    } catch (err) {
        console.log('execCommand Error', err);
    }
}

function logUserOperation(event) {
    // console.log('User performed <b>' + event.type + '</b> operation. Payload is: <b>' + event.clipboardData.getData('text/plain') + '</b>');
}

function convertIfJson(text) {
    var svObj;
    try {
        svObj = JSON.parse(text);
    }
    catch (error) {
        return text;
    }

    //console.log(svObj.output_amplitudes);

    let newText = '[';
    for (let ampIdx = 0; ampIdx < svObj.output_amplitudes.length; ampIdx++) {
        let real = math.round(svObj.output_amplitudes[ampIdx].r, 3);
        let imag = math.round(svObj.output_amplitudes[ampIdx].i, 3);

        newText += real + (imag >= 0 ? '+' : '') + imag + 'j';

        if (ampIdx < svObj.output_amplitudes.length - 1) {
            newText += ',';
        }
    }
    newText += ']';

    console.log("newText: " + newText);
    return newText;

}

function handlePaste(event) {

    //console.log('In handlePaste <b>' + event.type + '</b> operation. Payload is: <b>' + event.clipboardData.getData('text/plain') + '</b>');
    patternMatrix = math.zeros(NUM_TRACKS, NUM_PATTERNS * NUM_STEPS);
    let txt = event.clipboardData.getData('text/plain');

    txt = convertIfJson(txt);
    console.log('txt: ' + txt);

    let tempStateStrArray = [];
    let pos = 0;


    // Remove everything up to and including the final '[' (but there should only be one)
    pos = txt.lastIndexOf('[');
    if (pos >= 0 && txt.length > pos + 1) {
        txt = txt.substring(pos + 1);
    }


    // Remove everything including and after the first ']' (but there should only be one)
    pos = txt.indexOf(']');
    if (pos >= 0) {
        txt = txt.substring(0, pos);
    }

    // Remove all spaces
    txt = txt.replace(/\s/g, '');

    // Populate tempStateStrArray
    tempStateStrArray = txt.split(',');
    //console.log('tempStateStrArray: ' + tempStateStrArray);


    // Populate tempStateComplexArray complex numbers
    let tempStateComplexArray = [];
    let soundVolumeArray = [];
    let trackNumArray = [];
    for (let idx = 0; idx < tempStateStrArray.length; idx++) {
        const complexNumStr = tempStateStrArray[idx];
        let amplitude = strToComplexNum(complexNumStr);
        //console.log('amplitude: ' + amplitude);
        tempStateComplexArray.push(amplitude);

        let probability = math.multiply(amplitude, math.conj(amplitude));
        let soundVolume = probability > 0 ? 1 : 0;
        soundVolumeArray.push(soundVolume);

        let trackNum = (amplitude.toPolar().phi / 6.283185307179586 * NUM_TRACKS + NUM_TRACKS) % NUM_TRACKS;
        trackNum = math.round(trackNum, 0);
        trackNumArray.push(trackNum);

        //console.log("trackNum: " + trackNum);

        patternMatrix = math.subset(patternMatrix, math.index(trackNum, idx), soundVolume);

    }
    console.log('tempStateComplexArray: ' + tempStateComplexArray);
    //console.log('soundVolumeArray: ' + soundVolumeArray);
    //console.log('trackNumArray: ' + trackNumArray);

    //console.log('patternMatrix: ' + patternMatrix);

    const stateVectorComplexMatrix = math.matrix(tempStateComplexArray);
    //console.log('stateVectorComplexMatrix: ' + stateVectorComplexMatrix);

    let tracksArray = [];
    for (let trackIdx = 0; trackIdx < NUM_TRACKS; trackIdx++) {
        let stepsArray = [];
        for (let stepIdx = 0; stepIdx < NUM_STEPS; stepIdx++) {
            stepsArray.push(math.subset(patternMatrix, math.index(trackIdx, stepIdx)));
        }
        let track = new Track(1, 0, 0, stepsArray);
        tracksArray.push(track);
        //tracksArray.push(stepsArray);
        //console.log(JSON.stringify({steps: stepsArray}));
    }

    let obj = {
        name: "drumbit",
        edition: "Plus",
        metadata: {
            author: "IBM Quantum Experience",
            title: "Quantum DJ",
            remarks: "Hearing a quantum state"
        },
        steps: 16,
        options: {
            tempo: 100,
            swing: 0,
            kit: "1606849743014",
            loop: "0",
            effect: {
                id: "0",
                level: 0
            },
            compressor: {
                bypass: 1,
                threshold: -20.299999237060547,
                ratio: 4,
                attack: 0.0010000000474974513,
                release: 0.25,
                knee: 5
            },
            lowpass: {
                bypass: 1,
                frequency: 800,
                q: 1
            },
            highpass: {
                bypass: 1,
                frequency: 800,
                q: 1
            },
            sensitivity: [
                [
                    0.33,
                    0.33,
                    9,
                    0.66,
                    244
                ],
                [
                    256
                ],
                [
                    256
                ],
                [
                    256
                ],
                [
                    3,
                    0.33,
                    6,
                    0.66,
                    4,
                    0.66,
                    15,
                    0.66,
                    15,
                    0.66,
                    208
                ],
                [
                    0.66,
                    2,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    0.66,
                    1,
                    0.66,
                    1,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    2,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    2,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    0.66,
                    2,
                    0.66,
                    3,
                    0.66,
                    0.66,
                    0.66,
                    5,
                    0.66,
                    3,
                    0.66,
                    3,
                    0.66,
                    0.66,
                    0.66,
                    5,
                    0.66,
                    177
                ],
                [
                    3,
                    0.33,
                    4,
                    0.66,
                    40,
                    0.66,
                    7,
                    0.66,
                    7,
                    0.66,
                    3,
                    0.66,
                    3,
                    0.66,
                    182
                ],
                [
                    7,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    12,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    11,
                    0.66,
                    0.66,
                    1,
                    0.66,
                    0.66,
                    12,
                    0.66,
                    0.66,
                    7,
                    0.66,
                    6,
                    0.66,
                    0.66,
                    183
                ]
            ]
        },
        bank1: {
            pattern1: {
                "track1": createTrackFromPatternMatrix(7, 0),
                "track2": createTrackFromPatternMatrix(6, 0),
                "track3": createTrackFromPatternMatrix(5, 0),
                "track4": createTrackFromPatternMatrix(4, 0),
                "track5": createTrackFromPatternMatrix(3, 0),
                "track6": createTrackFromPatternMatrix(2, 0),
                "track7": createTrackFromPatternMatrix(1, 0),
                "track8": createTrackFromPatternMatrix(0, 0),
            },
            pattern2: {
                "track1": createTrackFromPatternMatrix(7, 1),
                "track2": createTrackFromPatternMatrix(6, 1),
                "track3": createTrackFromPatternMatrix(5, 1),
                "track4": createTrackFromPatternMatrix(4, 1),
                "track5": createTrackFromPatternMatrix(3, 1),
                "track6": createTrackFromPatternMatrix(2, 1),
                "track7": createTrackFromPatternMatrix(1, 1),
                "track8": createTrackFromPatternMatrix(0, 1),
            },
            pattern3: {
                "track1": createTrackFromPatternMatrix(7, 2),
                "track2": createTrackFromPatternMatrix(6, 2),
                "track3": createTrackFromPatternMatrix(5, 2),
                "track4": createTrackFromPatternMatrix(4, 2),
                "track5": createTrackFromPatternMatrix(3, 2),
                "track6": createTrackFromPatternMatrix(2, 2),
                "track7": createTrackFromPatternMatrix(1, 2),
                "track8": createTrackFromPatternMatrix(0, 2),
            },
            pattern4: {
                "track1": createTrackFromPatternMatrix(7, 3),
                "track2": createTrackFromPatternMatrix(6, 3),
                "track3": createTrackFromPatternMatrix(5, 3),
                "track4": createTrackFromPatternMatrix(4, 3),
                "track5": createTrackFromPatternMatrix(3, 3),
                "track6": createTrackFromPatternMatrix(2, 3),
                "track7": createTrackFromPatternMatrix(1, 3),
                "track8": createTrackFromPatternMatrix(0, 3),
            }
        },
        bank2: {
            pattern1: {
                "track1": createTrackFromPatternMatrix(7, 4),
                "track2": createTrackFromPatternMatrix(6, 4),
                "track3": createTrackFromPatternMatrix(5, 4),
                "track4": createTrackFromPatternMatrix(4, 4),
                "track5": createTrackFromPatternMatrix(3, 4),
                "track6": createTrackFromPatternMatrix(2, 4),
                "track7": createTrackFromPatternMatrix(1, 4),
                "track8": createTrackFromPatternMatrix(0, 4),
            },
            pattern2: {
                "track1": createTrackFromPatternMatrix(7, 5),
                "track2": createTrackFromPatternMatrix(6, 5),
                "track3": createTrackFromPatternMatrix(5, 5),
                "track4": createTrackFromPatternMatrix(4, 5),
                "track5": createTrackFromPatternMatrix(3, 5),
                "track6": createTrackFromPatternMatrix(2, 5),
                "track7": createTrackFromPatternMatrix(1, 5),
                "track8": createTrackFromPatternMatrix(0, 5),
            },
            pattern3: {
                "track1": createTrackFromPatternMatrix(7, 6),
                "track2": createTrackFromPatternMatrix(6, 6),
                "track3": createTrackFromPatternMatrix(5, 6),
                "track4": createTrackFromPatternMatrix(4, 6),
                "track5": createTrackFromPatternMatrix(3, 6),
                "track6": createTrackFromPatternMatrix(2, 6),
                "track7": createTrackFromPatternMatrix(1, 6),
                "track8": createTrackFromPatternMatrix(0, 6),
            },
            pattern4: {
                "track1": createTrackFromPatternMatrix(7, 7),
                "track2": createTrackFromPatternMatrix(6, 7),
                "track3": createTrackFromPatternMatrix(5, 7),
                "track4": createTrackFromPatternMatrix(4, 7),
                "track5": createTrackFromPatternMatrix(3, 7),
                "track6": createTrackFromPatternMatrix(2, 7),
                "track7": createTrackFromPatternMatrix(1, 7),
                "track8": createTrackFromPatternMatrix(0, 7),
            }
        },
        bank3: {
            pattern1: {
                "track1": createTrackFromPatternMatrix(7, 8),
                "track2": createTrackFromPatternMatrix(6, 8),
                "track3": createTrackFromPatternMatrix(5, 8),
                "track4": createTrackFromPatternMatrix(4, 8),
                "track5": createTrackFromPatternMatrix(3, 8),
                "track6": createTrackFromPatternMatrix(2, 8),
                "track7": createTrackFromPatternMatrix(1, 8),
                "track8": createTrackFromPatternMatrix(0, 8),
            },
            pattern2: {
                "track1": createTrackFromPatternMatrix(7, 9),
                "track2": createTrackFromPatternMatrix(6, 9),
                "track3": createTrackFromPatternMatrix(5, 9),
                "track4": createTrackFromPatternMatrix(4, 9),
                "track5": createTrackFromPatternMatrix(3, 9),
                "track6": createTrackFromPatternMatrix(2, 9),
                "track7": createTrackFromPatternMatrix(1, 9),
                "track8": createTrackFromPatternMatrix(0, 9),
            },
            pattern3: {
                "track1": createTrackFromPatternMatrix(7, 10),
                "track2": createTrackFromPatternMatrix(6, 10),
                "track3": createTrackFromPatternMatrix(5, 10),
                "track4": createTrackFromPatternMatrix(4, 10),
                "track5": createTrackFromPatternMatrix(3, 10),
                "track6": createTrackFromPatternMatrix(2, 10),
                "track7": createTrackFromPatternMatrix(1, 10),
                "track8": createTrackFromPatternMatrix(0, 10),
            },
            pattern4: {
                "track1": createTrackFromPatternMatrix(7, 11),
                "track2": createTrackFromPatternMatrix(6, 11),
                "track3": createTrackFromPatternMatrix(5, 11),
                "track4": createTrackFromPatternMatrix(4, 11),
                "track5": createTrackFromPatternMatrix(3, 11),
                "track6": createTrackFromPatternMatrix(2, 11),
                "track7": createTrackFromPatternMatrix(1, 11),
                "track8": createTrackFromPatternMatrix(0, 11),
            }
        },
        bank4: {
            pattern1: {
                "track1": createTrackFromPatternMatrix(7, 12),
                "track2": createTrackFromPatternMatrix(6, 12),
                "track3": createTrackFromPatternMatrix(5, 12),
                "track4": createTrackFromPatternMatrix(4, 12),
                "track5": createTrackFromPatternMatrix(3, 12),
                "track6": createTrackFromPatternMatrix(2, 12),
                "track7": createTrackFromPatternMatrix(1, 12),
                "track8": createTrackFromPatternMatrix(0, 12),
            },
            pattern2: {
                "track1": createTrackFromPatternMatrix(7, 13),
                "track2": createTrackFromPatternMatrix(6, 13),
                "track3": createTrackFromPatternMatrix(5, 13),
                "track4": createTrackFromPatternMatrix(4, 13),
                "track5": createTrackFromPatternMatrix(3, 13),
                "track6": createTrackFromPatternMatrix(2, 13),
                "track7": createTrackFromPatternMatrix(1, 13),
                "track8": createTrackFromPatternMatrix(0, 13),
            },
            pattern3: {
                "track1": createTrackFromPatternMatrix(7, 14),
                "track2": createTrackFromPatternMatrix(6, 14),
                "track3": createTrackFromPatternMatrix(5, 14),
                "track4": createTrackFromPatternMatrix(4, 14),
                "track5": createTrackFromPatternMatrix(3, 14),
                "track6": createTrackFromPatternMatrix(2, 14),
                "track7": createTrackFromPatternMatrix(1, 14),
                "track8": createTrackFromPatternMatrix(0, 14),
            },
            pattern4: {
                "track1": createTrackFromPatternMatrix(7, 15),
                "track2": createTrackFromPatternMatrix(6, 15),
                "track3": createTrackFromPatternMatrix(5, 15),
                "track4": createTrackFromPatternMatrix(4, 15),
                "track5": createTrackFromPatternMatrix(3, 15),
                "track6": createTrackFromPatternMatrix(2, 15),
                "track7": createTrackFromPatternMatrix(1, 15),
                "track8": createTrackFromPatternMatrix(0, 15),
            }
        },
    };

    //console.log(JSON.stringify(obj));

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `quantum_drumbit.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
}

document.addEventListener('cut', logUserOperation);
document.addEventListener('copy', logUserOperation);
document.addEventListener('paste', handlePaste);