"use strict";

class HeartRate {
    constructor(videoObject) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 100;
        this.canvas.height = 100;
        this.context = this.canvas.getContext('2d');

        this.video = videoObject;
        this.videoWidth = videoObject.width;
        this.videoHeight = videoObject.height;

        this.graphCanvas = document.createElement('canvas');
        this.graphCanvas.width = 320;
        this.graphCanvas.height = 30;
        this.graphContext = this.graphCanvas.getContext('2d');

        this.constraints = {
            video: true,
            audio: false
        };

        this.history = [];
    }

    initialize() {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            devices.forEach((device) => {
                if (device.kind=="videoinput") {
                    this.constraints.video = {
                        optional: [
                            {
                                sourceId: device.deviceId
                            },
                            {
                                fillLightMode: "on"
                            }
                        ]
                    };
                }
            });
        }).catch((err) => {
            console.log(err.name + ": " + err.message);
        });

        navigator.getUserMedia(this.constraints, this.start.bind(this), () => {});
    }

    start(stream) {
        try {
            this.video.srcObject = stream;
        } catch (err) {
            this.video.src = (window.webkitURL ? window.webkitURL : URL).createObjectURL(stream);
        }

        this.video.play();

        requestAnimationFrame(this.draw.bind(this));
    }

    readFrame() {
        try {
            this.context.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);
        } catch (e) {
            return null;
        }
    
        return this.context.getImageData(0, 0, this.videoWidth, this.videoHeight);
    }
    
    draw() {
        let frame = this.readFrame();
        if (frame) {
            this.getIntensity(frame.data);
        }

        requestAnimationFrame(this.draw.bind(this));
    }

    getIntensity = (data) => {
        let gcv = this.graphCanvas;
        let hist = this.history;
        let len = data.length;
        let sum = 0;
    
        for (var i = 0, j = 0; j < len; i++, j += 4) {
            sum += data[j] + data[j+1] + data[j+2];
        }
        //console.log(sum / len);   
        hist.push({
            bright : sum/len,
            time : Date.now() 
        });
        while (hist.length > gcv.width) {
            hist.shift();
        }
        // max and min
        let max = hist[0].bright;
        let min = hist[0].bright;
        hist.forEach(function(v) {
          if (v.bright>max) max=v.bright;
          if (v.bright<min) min=v.bright;
        });
        // thresholds for bpm
        var lo = min*0.6 + max*0.4;
        var hi = min*0.4 + max*0.6;
        var pulseAvr = 0, pulseCnt = 0;
        // draw
        var ctx = this.graphContext;
        ctx.clearRect(0, 0, gcv.width, gcv.height);
        ctx.beginPath();
        ctx.moveTo(0,0);
        hist.forEach(function(v,x) {
          var y = gcv.height*(v.bright-min)/(max-min);
          ctx.lineTo(x,y);
        });       
        ctx.stroke();
        // work out bpm
        var isHi = undefined;
        var lastHi = undefined;
        var lastLo = undefined;
        ctx.fillStyle = "red";
        hist.forEach(function(v, x) {
          if (isHi!=true && v.bright>hi) {
            isHi = true;
            lastLo = x;
          }
          if (isHi!=false && v.bright<lo) {
            if (lastHi !== undefined && lastLo !== undefined) {
                pulseAvr += hist[x].time-hist[lastHi].time;
                pulseCnt++;
                ctx.fillRect(lastLo,gcv.height-4,lastHi-lastLo,4);
            }
            isHi = false;
            lastHi = x;
          }
        });
        // write bpm
        if (pulseCnt) {
            var pulseRate = 60000 / (pulseAvr / pulseCnt);
            this.bpm = pulseRate.toFixed(0);
            this.pulses = pulseCnt;
        } else {
            this.bpm = -1;
        }
        this.history = hist;
      }
}
