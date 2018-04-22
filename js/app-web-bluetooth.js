/*
​x=r sin(φ)cos(θ)
​y=r sin(φ)sin(θ)
​z=r cos(φ)
*/
/* DATA SAMPLE TEMPLATE
{
  Thermo1 Object Temp,
  Thermo2 Object Temp,
  Thermo3 Object Temp,
  Thermo4 Object Temp,
  Distance,
  Pitch,
  Roll,
  Acc X,
  Acc Y,
  Acc Z,
  Thermo Ave. Device Temp,
  Time Stamp,
  Hand,
  Target,
  on/off Target Observed
}*/

/*
        collectedDataArray[0] =  pressureRunningAverage;
        collectedDataArray[1] =  humidityRunningAverage;
        collectedDataArray[2] =  tempSkinRunningAverage;
        collectedDataArray[3] =  tempAirRunningAverage;

        collectedDataArray[4] =  pressureAverage;
        collectedDataArray[5] =  humidityAverage;
        collectedDataArray[6] =  tempSkinAverage;

        collectedDataArray[7] =  pressureDelta;
        collectedDataArray[8] =  humidityDelta;
        collectedDataArray[9] =  tempSkinDelta;
*/



/*******************************************************************************************************************
 *********************************************** INITIALIZE *********************************************************
 ********************************************************************************************************************/
let accelerometerData, thermopileData, proximityData, ambientTempData, heartRateData;

var timeStamp = new Date().getTime();



//is device observed to be on target
onTarget = false;

//record data each time a sensor data sample is received
recordFlag = false;

var databaseConnected = false;
var batchedData = new Array;

//sensor array sample data
var sensorDataArray = new Array(12).fill(0);

//sensor data average tracking
var pressureHistory, humidityHistory, tempAirHistory, tempSkinHistory, timeHistory, pressureDeltaHistory;
var pressureDelta = 0; var humidityDelta = 0; var tempAirDelta = 0; var tempSkinDelta = 0;

var pressureRunningAverageOld, pressureMin, pressureMax, humidityMin, humidityMax;
var pressureAverage, humidityAverage, tempSkinAverage, tempAirAverage, pressureDeltaAverage;
var pressureRunningAverage, humidityRunningAverage, tempSkinRunningAverage, tempAirRunningAverage;
var initAverages = true;

var lastSignificantPressureDelta = 0;
var respHistory = [{time: 0, direction: "inward"}, {time: 0, direction: "outward"}, {time: 0, direction: "inward"}, {time: 0, direction: "outward"}];
var respRate = 0;

//sensor array sample data FOR CUSTOM TRAINING
var NNInhaleDataArray = new Array;
var NNExhaleDataArray = new Array;
var NNHoldDataArray = new Array;

var NNArchitecture = 'none';

var NNNumInputs = 2;

//master session data array of arrays
var sensorDataSession = [];

//which samples in the session data array are part of a particular sample set
var sessionSampleSetIndex = [];

//track number of sets
var numSets = 0;

var getSamplesFlag = 0;
var getSamplesTypeFlag = 0; //0=none 1=NN1T 2=NN1F 3=NN2T 4=NN2F

//do we have a trained NN to apply to live sensor data?
var haveNNFlag = false;
var trainNNFlag = false;
var activeNNFlag = false;

//load NN exported activation functions and weights
var loadNNFlag = false;

//NN scores
var scoreArray = new Array(1).fill(0);

var initialised = false;
var timeout = null;

//LUNG ANIMATION GLOBALS
var lungShadowsBreathing, bitsright4, bitsright3, bitsright2, bitsright1, bitsleft4, bitsleft3, bitsleft2, bitsleft1, lungright, lungleft, ciliaBreathing;
var boxref, scrubber;


//window.onload = function(){
$(document).ready(function() {


    /*******************************************************************************************************************
     *********************************************** WEB BLUETOOTH ******************************************************
     ********************************************************************************************************************/
       if ( 'bluetooth' in navigator === false ) {
          button.style.display = 'none';
          message.innerHTML = 'This browser doesn\'t support the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> :(';
      }

    //Web Bluetooth connection button and ongoing device data update function
    button.onclick = function(e) {

        var sensorController = new ControllerWebBluetooth("RespRetainer");
        sensorController.connect();

        //ON SENSOR DATA UPDATE
        sensorController.onStateChange(function(state) {
            bluetoothDataFlag = true;
        });

        //check for new data every X milliseconds - this is to decouple execution from Web Bluetooth actions
        setInterval(function() {
            //     bluetoothDataFlag = getBluetoothDataFlag();

            if (bluetoothDataFlag == true) {

                timeStamp = new Date().getTime();

                //load data into global array
                sensorDataArray = new Array(12).fill(0);

                sensorDataArray[0] = state.thermopile.tempSkin.toFixed(2);
                sensorDataArray[1] = state.barometer.pressure.toFixed(2);
                sensorDataArray[2] = state.barometer.humidity.toFixed(2);
                sensorDataArray[3] = state.barometer.tempAir.toFixed(2);

                sensorDataArray[4] = state.thermopile.tempDevice.toFixed(1);

                sensorDataArray[5] = state.accelerometer.pitch.toFixed(1);
                sensorDataArray[6] = state.accelerometer.roll.toFixed(1);
                sensorDataArray[7] = state.accelerometer.x.toFixed(2);
                sensorDataArray[8] = state.accelerometer.y.toFixed(2);
                sensorDataArray[9] = state.accelerometer.z.toFixed(2);

                //so initial display doesn't look wonky for want of data
                if(initAverages){
                    initAverages = false;
                    pressureHistory = new Array(300).fill(state.barometer.pressure);
                    humidityHistory = new Array(300).fill(state.barometer.humidity);
                    tempSkinHistory = new Array(300).fill(state.thermopile.tempSkin);
                    tempAirHistory = new Array(300).fill(state.barometer.tempAir);
                    timeHistory = new Array(300).fill( new Date().getTime() );
                    pressureDeltaHistory = new Array(300).fill(0);

                    pressureRunningAverage = state.barometer.pressure;
                    humidityRunningAverage = state.barometer.humidity;
                    tempSkinRunningAverage = state.thermopile.tempSkin;
                    tempAirRunningAverage = state.barometer.tempAir;

                    pressureAverage = state.barometer.pressure;
                    humidityAverage = state.barometer.humidity;

                    //Create Lung Animation
                    createLungAnimation();
                }

                //update running averages
                pressureRunningAverage = (pressureRunningAverage + state.barometer.pressure) / 2;
                humidityRunningAverage = (humidityRunningAverage + state.barometer.humidity) / 2;
                tempSkinRunningAverage = (tempSkinRunningAverage + state.thermopile.tempSkin) / 2;
                tempAirRunningAverage = (tempAirRunningAverage + state.barometer.tempAir) / 2;

                /**************** PROCESS DATA ******************/
                processData();


                //update time series chart
                var rawTempSkinChart = ((tempSkinRunningAverage - 74) / 24);
                var rawPressureChart = ((pressureRunningAverage - pressureAverage + 100) / 200);
                var rawHumidityChart = ((humidityRunningAverage - humidityAverage + 3) / 6);
                var rawTempAirChart = ((tempAirRunningAverage - 74) / 24);
             //   var rawPitchChart = (sensorDataArray[5] / 400);
            //    var rawRollChart = (sensorDataArray[6] / 400);
                var rawTempDeviceChart = ((sensorDataArray[4] - 74) / 24);

          //      var rawPressureDeltaChart = (( pressureDelta + 150) / 300);
          //      var rawTempSkinDeltaChart = (( tempSkinDelta + 30) / 60);


                //sensor values in bottom 2/3 of chart , 1/10 height each
                

                rawTempSkinChart = (rawTempSkinChart / 4.5) + 5 * 0.1;
             //   rawTempSkinDeltaChart = (rawTempSkinDeltaChart / 4.5) + 6 * 0.1;

                rawTempAirChart = (rawTempAirChart / 4.5) + 4 * 0.1;
                rawTempDeviceChart = (rawTempDeviceChart / 4.5) + 3 * 0.1;
                rawPressureChart = (rawPressureChart / 4.5) + 2 * 0.1;
            //    rawPressureDeltaChart = (rawPressureDeltaChart / 4.5) + 2 * 0.1;

                rawHumidityChart = (rawHumidityChart / 4.5) + 1 * 0.1;
             //   rawPitchChart = (rawPitchChart / 8) + 2 * 0.1;
             //   rawRollChart = (rawRollChart / 8) + 1 * 0.1;
                

                lineTempSkin.append(timeStamp, rawTempSkinChart);
              //  lineTempSkinDelta.append(timeStamp, rawTempSkinDeltaChart);
                linePressure.append(timeStamp, rawPressureChart);
            //    linePressureDelta.append(timeStamp, rawPressureDeltaChart);
                lineHumidity.append(timeStamp, rawHumidityChart);
                lineTempAir.append(timeStamp, rawTempAirChart);
                
            //    linePitch.append(timeStamp, rawPitchChart);
            //    lineRoll.append(timeStamp, rawRollChart);
                lineTempDevice.append(timeStamp, rawTempDeviceChart);


                //if data sample collection has been flagged
                //  getSensorData();
                if (getSamplesFlag > 0) {
                    collectData();
                } else if (trainNNFlag) {
                    //don't do anything
                } else {
                    if (haveNNFlag && activeNNFlag) { //we have a NN and we want to apply to current sensor data
                        getNNScore(1);
                    } else if (loadNNFlag) { // !!! NOPE DISABLE FIRST LOADED NN
                        getNNScore(1);
                    }
                  

                }

                displayData();

                bluetoothDataFlag = false;
            }

        }, 50); //100 = 10Hz limit
	}


        function processData() {

                var pressureTotal = pressureRunningAverage;
                var humidityTotal = humidityRunningAverage;
                var tempSkinTotal = tempSkinRunningAverage;
                var tempAirTotal = tempAirRunningAverage;
                var pressureDeltaTotal = pressureDelta;
                var totalCount = 1;

                pressureMin = 150000;
                pressureMax = 0;
                tempSkinMin = 999;
                tempSkinMax = 0;
                humidityMin = 999;
                humidityMax = 0;

                //add current data to stored data
                for(var i = 0; i < 299; i++){ //keep last 30 second
                    pressureHistory[i] = pressureHistory[i + 1];
                    humidityHistory[i] = humidityHistory[i + 1];
                    tempAirHistory[i] = tempAirHistory[i + 1];
                    tempSkinHistory[i] = tempSkinHistory[i + 1];
                    timeHistory[i] = timeHistory[i + 1];
                    pressureDeltaHistory[i] = pressureDeltaHistory[i + 1];

                }
                pressureHistory[299] = pressureRunningAverage;
                humidityHistory[299] = humidityRunningAverage;
                tempSkinHistory[299] = tempSkinRunningAverage;
                tempAirHistory[299] = tempAirRunningAverage;
                timeHistory[299] = currentDataTimestamp;
                pressureDeltaHistory[299] = pressureDelta;

           //     console.log("timeHistory current time: " + currentDataTimestamp);

                //find averages and max/min over particular duration
                for(var j = 200; j < 299; j++){ //over last 15 seconds
                    pressureTotal = pressureTotal + pressureHistory[j];
                    tempSkinTotal = tempSkinTotal + tempSkinHistory[j];
                    humidityTotal = humidityTotal + humidityHistory[j];
                    pressureDeltaTotal = pressureDeltaTotal + Math.abs(pressureDeltaHistory[j]);

                    if(pressureHistory[i] > pressureMax) pressureMax = pressureHistory[j];
                    if(pressureHistory[i] < pressureMin) pressureMin = pressureHistory[j];

                    if(tempSkinHistory[i] > tempSkinMax) tempSkinMax = tempSkinHistory[j];
                    if(tempSkinHistory[i] < tempSkinMin) tempSkinMin = tempSkinHistory[j];

                    if(humidityHistory[i] > humidityMax) humidityMax = humidityHistory[j];
                    if(humidityHistory[i] < humidityMin) humidityMin = humidityHistory[j];

                	totalCount++;
                }

                pressureAverage = pressureTotal / totalCount;
                tempSkinAverage = tempSkinTotal / totalCount;
                humidityAverage = humidityTotal / totalCount;
                pressureDeltaAverage = pressureDeltaTotal / totalCount;


                  /****************** FIND Delta FOR PEAK DETECTION *********************/
				var pressureDeltaTotal = 0; var tempSkinDeltaTotal = 0; var humidityDeltaTotal = 0;
                var timePassed = timeHistory[299] - timeHistory[295];

             //   console.log("Time passed delta: " + timePassed);

                var deltaCount = 0;
                for(var m = 295; m < 299; m++){
                	pressureDeltaTotal = pressureDeltaTotal + ( pressureHistory[m + 1] - pressureHistory[m] );
                	tempSkinDeltaTotal = tempSkinDeltaTotal + ( tempSkinHistory[m + 1] - tempSkinHistory[m] );
                	humidityDeltaTotal = humidityDeltaTotal + ( humidityHistory[m + 1] - humidityHistory[m] );
                }

                //smooth data by averaging with last
                pressureDelta = ( (pressureDelta * 2) + ( pressureDeltaTotal / (timePassed / 1000) ) ) / 3; //multiply by 100 for ms --> s
                tempSkinDelta = ( (tempSkinDelta * 2) + ( tempSkinDeltaTotal / (timePassed / 1000) ) ) / 3; //multiply by 100 for ms --> s 
                humidityDelta = ( (humidityDelta * 2) + ( humidityDeltaTotal / (timePassed / 1000) ) ) / 3; //multiply by 100 for ms --> s

                console.log("pressureDeltaAverage: " + pressureDeltaAverage + " pressureDelta: " + pressureDelta + "  tempSkinDelta: " + tempSkinDelta + "  pressureAverage: " + pressureAverage + "  tempSkinAverage: " + tempSkinAverage);


                //detect resperiation rate
            /*    if(lastSignificantPressureDelta > 0 && pressureDelta < 0){
                    respRate = respEvent("inward");
                    lastSignificantPressureDelta = 0;
                } else if(lastSignificantPressureDelta < 0 && pressureDelta > 0){ 
                    respRate = respEvent("outward");
                    lastSignificantPressureDelta = 0;
                } else if( Math.abs(pressureDelta) > 3){
                    lastSignificantPressureDelta = pressureDelta;
                }
                console.log("Respiration: " + respRate); */

                /****************** LUNG ANIMATION *********************/
                var animationMultiple;
           /*     var $lungShadowsBreathing = $('.lung-shadows-breathing');
                var $bitsright4 = $('.breathing-right-bits img.lung-bit-4');
                var $bitsright3 = $('.breathing-right-bits img.lung-bit-3');
                var $bitsright2 = $('.breathing-right-bits img.lung-bit-2');
                var $bitsright1 = $('.breathing-right-bits img.lung-bit-1');
                var $bitsleft4 = $('.breathing-left-bits img.lung-bit-4');
                var $bitsleft3 = $('.breathing-left-bits img.lung-bit-3');
                var $bitsleft2 = $('.breathing-left-bits img.lung-bit-2');
                var $bitsleft1 = $('.breathing-left-bits img.lung-bit-1');
                var $lungright = $('.lung-right-breathing img');
                var $lungleft = $('.lung-left-breathing img');
                var $ciliaBreathing = $('.cilia-breathing'); */
                var animationPressureMax = 0;
                var animationPressureMin = 999999;
                var animationPressureAverage;
                var animationPressureTotal = 0;
                var animationPressureCount = 0;

                for(var k = 220; k < 300; k++){
                    if(pressureHistory[k] < animationPressureMin) animationPressureMin = pressureHistory[k];
                    if(pressureHistory[k] > animationPressureMax) animationPressureMax = pressureHistory[k];
                    animationPressureTotal = animationPressureTotal + pressureHistory[k];
                    animationPressureCount++;
                }

                animationPressureAverage = animationPressureTotal / animationPressureCount;

                var midMin = (animationPressureAverage + (animationPressureMin * 3) ) / 4;
                var midMax = (animationPressureAverage + (animationPressureMax * 3) ) / 4;
                if(pressureRunningAverage > midMax){ animationMultiple = 1; }
                else if(pressureRunningAverage < midMin){ animationMultiple = 0; }
                else{
                    animationMultiple =  (pressureRunningAverage - midMin) / (midMax - midMin);
                }
            //    console.log("ANIMATION MULTIPLE: " + animationMultiple + "   " + animationPressureAverage + "   " + animationPressureMin + "   " + animationPressureMax);

        /*        var lungWidthAni = 94 + (animationMultiple * 6);
                var lungRotateLeftAni = 3.5 * animationMultiple;
                var lungRotateRightAni = lungRotateLeftAni * (-1);

                $lungright.animate({width: lungWidthAni + "%", transform: "rotate(" + lungRotateRightAni + "deg)"}, 100);
                $lungleft.animate({width: lungWidthAni + "%", transform: "rotate(" + lungRotateLeftAni + "deg)"}, 100); */
                var animationlength = 10000;
                var adjustedAnimationFrame;
                if(pressureDelta > 0){
                	adjustedAnimationFrame = 0.5 + (0.5 * animationMultiple);
                } else if(pressureDelta < 0){
                	adjustedAnimationFrame = 0.5 - (0.5 * animationMultiple);
                } 

                ciliaBreathing.currentTime = scrubber.value * animationlength;
                lungleft.currentTime = adjustedAnimationFrame * animationlength;
                lungright.currentTime = adjustedAnimationFrame * animationlength;
                bitsleft1.currentTime = adjustedAnimationFrame * animationlength;
                bitsleft2.currentTime = adjustedAnimationFrame * animationlength;
                bitsleft3.currentTime = adjustedAnimationFrame * animationlength;
                bitsleft4.currentTime = adjustedAnimationFrame * animationlength;
                bitsright1.currentTime = adjustedAnimationFrame * animationlength;
                bitsright2.currentTime = adjustedAnimationFrame * animationlength;
                bitsright3.currentTime = adjustedAnimationFrame * animationlength;
                bitsright4.currentTime = adjustedAnimationFrame * animationlength;
                lungShadowsBreathing.currentTime = adjustedAnimationFrame * animationlength;
        }




    //add smoothie.js time series streaming data chart
    // var chartHeight =  $(window).height() / 3;
    var chartHeight = 100;
    var chartWidth = $(window).width();

    $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');

    var streamingChart = new SmoothieChart({
        /*  grid: { strokeStyle:'rgb(125, 0, 0)', fillStyle:'rgb(60, 0, 0)',
                  lineWidth: 1, millisPerLine: 250, verticalSections: 6, },
          labels: { fillStyle:'rgb(60, 0, 0)' } */
    });

    /*******************************************************************************************************************
     **************************************** STREAMING SENSOR DATA CHART ***********************************************
     ********************************************************************************************************************/


    streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );
    var linePressure = new TimeSeries();
    var linePressureDelta = new TimeSeries();
    var lineHumidity = new TimeSeries();
    var lineTempAir = new TimeSeries();
    var lineTempSkin = new TimeSeries();
    var lineTempSkinDelta = new TimeSeries();
    var linePitch = new TimeSeries();
    var lineRoll = new TimeSeries();
    var lineTempDevice = new TimeSeries();
    var lineNNInhale = new TimeSeries();
    var lineNNExhale = new TimeSeries();
    var lineNNHold = new TimeSeries();
    streamingChart.addTimeSeries(linePressure, {
        strokeStyle: 'rgb(133, 87, 35)',
        lineWidth: 3
    });
 /*   streamingChart.addTimeSeries(linePressureDelta, {
        strokeStyle: 'rgb(133, 87, 35)',
        lineWidth: 3
    }); */
    streamingChart.addTimeSeries(lineHumidity, {
        strokeStyle: 'rgb(185, 156, 107)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineTempAir, {
        strokeStyle: 'rgb(143, 59, 27)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineTempSkin, {
        strokeStyle: 'rgb(213, 117, 0)',
        lineWidth: 3
    });
/*    streamingChart.addTimeSeries(lineTempSkinDelta, {
        strokeStyle: 'rgb(213, 117, 0)',
        lineWidth: 3
    }); */
  /*  streamingChart.addTimeSeries(linePitch, {
        strokeStyle: 'rgb(128, 128, 128)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineRoll, {
        strokeStyle: 'rgb(240, 240, 240)',
        lineWidth: 3
    }); */
    streamingChart.addTimeSeries(lineTempDevice, {
        strokeStyle: 'rgb(128, 128, 255)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineNNInhale, {
        strokeStyle: 'rgb(0, 204, 102)',
        lineWidth: 4
    });
    streamingChart.addTimeSeries(lineNNExhale, {
        strokeStyle: 'rgb(233, 185, 9)',
        lineWidth: 4
    });
    streamingChart.addTimeSeries(lineNNHold, {
        strokeStyle: 'rgb(255, 102, 102)',
        lineWidth: 4
    });


    //min/max streaming chart button
    $('#circleDrop').click(function() {

        $('.card-middle').slideToggle();
        $('.close').toggleClass('closeRotate');

        var chartHeight = $(window).height() / 1.2;
        var chartWidth = $(window).width();

        if ($("#chart-size-button").hasClass('closeRotate')) {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');
        } else {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + 100 + '"></canvas>');
        }

        streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );

        //hide controls
        $("#basic-interface-container, #hand-head-ui-container, #nn-slide-controls, .console, #interface-controls, #dump-print, #record-controls").toggleClass("hide-for-chart");

    });




    function displayData() {

        var tempSkinElement = document.getElementsByClassName('tempSkin-data')[0];
        tempSkinElement.innerHTML = sensorDataArray[0];

        var pressureElement = document.getElementsByClassName('pressure-data')[0];
        pressureElement.innerHTML = sensorDataArray[1];

        var humidityElement = document.getElementsByClassName('humidity-data')[0];
        humidityElement.innerHTML = sensorDataArray[2];

        var tempAirElement = document.getElementsByClassName('tempAir-data')[0];
        tempAirElement.innerHTML = sensorDataArray[3];

        var tempDeviceElement = document.getElementsByClassName('tempDevice-data')[0];
        tempDeviceElement.innerHTML = sensorDataArray[4];


        var pressureDeltaElement = document.getElementsByClassName('pressure-delta-data')[0];
        pressureDeltaElement.innerHTML = pressureDelta.toFixed(1);

        var tempSkinDeltaElement = document.getElementsByClassName('tempSkin-delta-data')[0];
        tempSkinDeltaElement.innerHTML = tempSkinDelta.toFixed(2);

 /*       var accelerometerPitchDiv = document.getElementsByClassName('accelerometer-pitch-data')[0];
        accelerometerPitchDiv.innerHTML = sensorDataArray[5];

        var accelerometerRollDiv = document.getElementsByClassName('accelerometer-roll-data')[0];
        accelerometerRollDiv.innerHTML = sensorDataArray[6];

        var accelerometerXElement = document.getElementsByClassName('accelerometer-x-data')[0];
        accelerometerXElement.innerHTML = sensorDataArray[7];

        var accelerometerYElement = document.getElementsByClassName('accelerometer-y-data')[0];
        accelerometerYElement.innerHTML = sensorDataArray[8];

        var accelerometerZElement = document.getElementsByClassName('accelerometer-z-data')[0];
        accelerometerZElement.innerHTML = sensorDataArray[9];

        var batteryDataElement = document.getElementsByClassName('battery-data')[0];
        batteryDataElement.innerHTML = batteryVoltage; */

    }

    function collectData() {

        var collectedDataArray = new Array(12).fill(0); //12 device 
     //   collectedDataArray[0] = sensorDataArray;
        //  var positionNumber = $('#master-pose-input').val() - 1;

        collectedDataArray[0] =  pressureRunningAverage;
        collectedDataArray[1] =  humidityRunningAverage;
        collectedDataArray[2] =  tempSkinRunningAverage;
        collectedDataArray[3] =  tempAirRunningAverage;

        collectedDataArray[4] =  pressureAverage;
        collectedDataArray[5] =  humidityAverage;
        collectedDataArray[6] =  tempSkinAverage;

        collectedDataArray[7] =  pressureDelta.toFixed(4);
        collectedDataArray[8] =  humidityDelta.toFixed(4);
        collectedDataArray[9] =  tempSkinDelta.toFixed(4);

        collectedDataArray[10] = pressureDeltaAverage.toFixed(4);

        /*
		collectedDataArray[0] = tempSkin
		collectedDataArray[1] = pressure
		collectedDataArray[2] = humidity
		collectedDataArray[3] = tempAir
		collectedDataArray[4] = tempDevice
		collectedDataArray[5] = pitch
		collectedDataArray[6] = roll
		*/

		//record which category data belongs to
        collectedDataArray[11] = getSamplesTypeFlag;

        console.log("web bluetooth sensor data:");

        console.dir(collectedDataArray);

        //add sample to set
        sensorDataSession.push(collectedDataArray);

        //minimum distance value for true data
        // if( (getSamplesTypeFlag == 1 || getSamplesTypeFlag == 3 ) && collectedDataArray[4] < 100){ collectedDataArray[4] = 100; }



        if (getSamplesTypeFlag == 1) {
            NNInhaleDataArray.push(collectedDataArray);
            $('.message-nn-inhale').html(NNInhaleDataArray.length);
        } else if (getSamplesTypeFlag == 2) {
            NNExhaleDataArray.push(collectedDataArray);
            $('.message-nn-exhale').html(NNExhaleDataArray.length);
        } else if (getSamplesTypeFlag == 3) {
            NNHoldDataArray.push(collectedDataArray);
            $('.message-nn-hold').html(NNHoldDataArray.length);
        }  

        sessionSampleSetIndex.push(numSets);

        console.log("Set Index: ");
        console.dir(sessionSampleSetIndex);

        getSamplesFlag = getSamplesFlag - 1;

    }

    function getNeuralNetworkData(inputLength, thePressureRunningAverage, theTempSkinRunningAverage, thePressureAverage, theTempSkinAverage, thePressureDelta, theTempSkinDelta, thePressureDeltaAverage,){
    	var normalizedArray = new Array(inputLength).fill(0);

        normalizedArray[0] = (thePressureRunningAverage / thePressureAverage) - 0.5;
        normalizedArray[1] = (theTempSkinRunningAverage / theTempSkinAverage) - 0.5;


        if (inputLength == 5) {
        	//normalize pressure delta
	        if(thePressureDelta > 150) normalizedArray[2] = 1;
	        else if (thePressureDelta < -150) normalizedArray[2] = 0; 
	        else normalizedArray[2] = (thePressureDelta + 150) / 300;

			//normalize skin temp delta
	        if(theTempSkinDelta > 30) normalizedArray[3] = 1;
	        else if (pressureDelta < -30) normalizedArray[3] = 0; 
	        else normalizedArray[3] = (pressureDelta + 30) / 60;

	        normalizedArray[4] = thePressureDeltaAverage;
	    }

        return normalizedArray;
    }



    /*******************************************************************************************************************
     ************************************** DATA RECORD AND FILE NAMES **************************************************
     ********************************************************************************************************************/

    function updateSampleCountDisplay() {
        $('.message-nn-inhale').html(NNInhaleDataArray.length);
        $('.message-nn-false').html(NNExhaleDataArray.length);
    }


    /*******************************************************************************************************************
     *********************************************** NEURAL NETWORKS ****************************************************
     ********************************************************************************************************************/
    /**
     * Attach synaptic neural net components to app object
     */
    var nnRate = $("#rate-input").val();
    var nnIterations = $("#iterations-input").val();
    var nnError = $("#error-input").val();

    // ************** NEURAL NET #1
    var Neuron = synaptic.Neuron;
    var Layer = synaptic.Layer;
    var Network = synaptic.Network;
    var Trainer = synaptic.Trainer;
    var Architect = synaptic.Architect;
    var neuralNet = new Architect.LSTM(4, 5, 5, 3);
    var trainer = new Trainer(neuralNet);
    var trainingData;



    function getNNScore(selectNN) {

        var scoreArray = new Array(3).fill(0);
        var displayScore = new Array(3).fill(0);
        var timeStamp = new Date().getTime();
        var feedArray, displayScore;

    	feedArray = getNeuralNetworkData(NNNumInputs, pressureRunningAverage, tempSkinRunningAverage, pressureAverage, tempSkinAverage, pressureDelta, tempSkinDelta, pressureDeltaAverage);


        // use trained NN or loaded NN
        if (haveNNFlag && activeNNFlag) {
            scoreArray = neuralNet.activate(feedArray);
        } else if (loadNNFlag) {
            scoreArray = neuralNetwork(feedArray);
        }

        console.log("NN FEED ARRAY: " + feedArray);
        console.log("NN SCORE ARRAY: " + scoreArray);

        displayScore[0] = scoreArray[0].toFixed(4) * 100;
        displayScore[1] = scoreArray[1].toFixed(4) * 100;
        displayScore[2] = scoreArray[2].toFixed(4) * 100;
        displayScore[0] = displayScore[0].toFixed(2);
        displayScore[1] = displayScore[1].toFixed(2);
        displayScore[2] = displayScore[2].toFixed(2);

        $(".message-nn-inhale-score").html(displayScore[0] + '%');
        $(".message-nn-exhale-score").html(displayScore[1] + '%');
        $(".message-nn-hold-score").html(displayScore[2] + '%');

        var rawlineNNInhaleChart = scoreArray[0].toFixed(4);
        rawlineNNInhaleChart = (rawlineNNInhaleChart / 3) + 0.8;
        lineNNInhale.append(timeStamp, rawlineNNInhaleChart);

        var rawlineNNExhaleChart = scoreArray[1].toFixed(4);
        rawlineNNExhaleChart = (rawlineNNExhaleChart / 3) + 0.8;
        lineNNExhale.append(timeStamp, rawlineNNExhaleChart);

        var rawlineNNHoldChart = scoreArray[2].toFixed(4);
        rawlineNNHoldChart = (rawlineNNHoldChart / 3) + 0.8;
        lineNNHold.append(timeStamp, rawlineNNHoldChart);

    }



    /**************************** TRAIN NN ******************************/
    function trainNN() {
        //'2:2:3', '2:4:4:3', '4:4:3', '4:5:5:3', '4:8:8:3'
        //  var processedDataSession = sensorDataSession;
        var processedDataSession = new Array;
        var exhaleDataArray = new Array;
        var inhaleDataArray = new Array;
        var holdDataArray = new Array;

        trainingData = new Array;

        var rawNNArchitecture = $(".range-slider__value.nn-architecture").html();
        var numInputs = parseInt(rawNNArchitecture.charAt(0));

        nnRate = $("#rate-input").val();
        nnIterations = $("#iterations-input").val();
        nnError = $("#error-input").val();

        //hide collected data total messages and show NN score messages
        $("#data-message").css("display", "none");
        $("#data-message-scores").css("display", "block");

        
        inhaleDataArray = NNInhaleDataArray;
        exhaleDataArray = NNExhaleDataArray;
        holdDataArray = NNHoldDataArray;
        

        //combine true and false data
        var addSample = new Array(12).fill(0);

        for (var j = 0; j < inhaleDataArray.length; j++) {
            addSample = inhaleDataArray[j];
            addSample[11] = 0; //true
            processedDataSession.push(addSample);
        }
        for (var k = 0; k < exhaleDataArray.length; k++) {
            addSample = exhaleDataArray[k];
            addSample[11] = 1; //false
            processedDataSession.push(addSample);
        }
        for (var m = 0; m < holdDataArray.length; m++) {
            addSample = holdDataArray[m];
            addSample[11] = 2; //false
            processedDataSession.push(addSample);
        }


        //   console.log("raw NN architecture: " + rawNNArchitecture);

        
        NNArchitecture = rawNNArchitecture;

        if (rawNNArchitecture == '2:2:3') {
            neuralNet = new Architect.LSTM(2, 2, 3);
        } else if (rawNNArchitecture == '2:4:4:3') {
            neuralNet = new Architect.LSTM(2, 4, 4, 3);
        } else if (rawNNArchitecture == '5:4:3') {
            neuralNet = new Architect.LSTM(5, 5, 3);
        } else if (rawNNArchitecture == '5:5:5:3') {
            neuralNet = new Architect.LSTM(5, 5, 5, 3);
        } else if (rawNNArchitecture == '5:8:8:3') {
            neuralNet = new Architect.LSTM(5, 8, 8, 3);
        } 

        NNArchitecture = rawNNArchitecture;
        NNNumInputs = numInputs;
        trainer = new Trainer(neuralNet);


        for (var i = 0; i < processedDataSession.length; i++) {

            var currentSample = processedDataSession[i];
            var outputArray = new Array(3).fill(0);

            if(currentSample[11] == 0){  //inhale
            	outputArray[0] = 1; outputArray[1] = 0; outputArray[2] = 0;
            } else if(currentSample[11] == 1){  //exhale
            	outputArray[0] = 0; outputArray[1] = 1; outputArray[2] = 0;
            } else if(currentSample[11] == 2){  //hold
	            outputArray[0] = 0; outputArray[1] = 0; outputArray[2] = 1;
	        }

            /*
		        collectedDataArray[0] =  pressureRunningAverage;
		        collectedDataArray[1] =  humidityRunningAverage;
		        collectedDataArray[2] =  tempSkinRunningAverage;
		        collectedDataArray[3] =  tempAirRunningAverage;

		        collectedDataArray[4] =  pressureAverage;
		        collectedDataArray[5] =  humidityAverage;
		        collectedDataArray[6] =  tempSkinAverage;

		        collectedDataArray[7] =  pressureDelta;
		        collectedDataArray[8] =  humidityDelta;
		        collectedDataArray[9] =  tempSkinDelta;
			*/
			 //   function getNeuralNetworkData(numInputs, thePressureRunningAverage, theTempSkinRunningAverage, thePressureAverage, theTempSkinAverage, thePressureDelta, theTempSkinDelta, thePressureDeltaAverage){
			var inputArray =  getNeuralNetworkData(numInputs, currentSample[0], currentSample[2], currentSample[4], currentSample[6], currentSample[7], currentSample[9], currentSample[10]);

            trainingData.push({
                input: inputArray,
                output: outputArray
            });

            console.log(currentSample + " TRAINING INPUT: " + inputArray + " TRAINING OUTPUT: " + outputArray);
            

        }

        console.log("TRAINING ON selectNN --> interations:" + nnIterations + "  error:" + nnError + "  rate:" + nnRate + "  arch:" + rawNNArchitecture + "  inputs:" + numInputs);

        trainer.train(trainingData, {
            rate: nnRate,
            //   iterations: 15000,
            iterations: nnIterations,
            error: nnError,
            shuffle: true,
            //   log: 1000,
       //     log: 5,
            cost: Trainer.cost.CROSS_ENTROPY,
            schedule: {
				every: 10, // repeat this task every 500 iterations
				do: function(data) {
					// custom log
					$(".console").html("<p>ERROR: " + data.error + "     ITERATIONS: " + data.iterations + "      RATE:" + data.rate + "</p>");

				}
			}
        });

        //we have a trained NN to use
        haveNNFlag = true;
        trainNNFlag = false;
        $('#activate-btn').addClass("haveNN");
        $('#export-btn').addClass("haveNN");
    }

    //end window on load
    //}
    //});




    /*******************************************************************************************************************
     ******************************************* NEURAL NETWORK BUTTONS *************************************************
     ********************************************************************************************************************/
    $('#train-btn').click(function() {
        console.log("train button 1");
        trainNNFlag = true;
        trainNN();
    });

    $('#activate-btn').click(function() {
        console.log("activate button");
        activeNNFlag = true;
        $('#activate-btn').toggleClass("activatedNN");

        //if loaded NN, turn off
        if (loadNNFlag) {
            loadNNFlag = false;
            $('#load-nn-btn').toggleClass("activatedNN");
        }
    });

    

    // ************* LOAD TWO EXPORTED NEURAL NET ACTIVATION FUNCTIONS AND WEIGHTS
    $('#load-nn-btn').click(function() {
        console.log("load exported NN button");
        loadNNFlag = true;
        $('#load-nn-btn').toggleClass("activatedNN");
    });
    /*******************************************************************************************************************
     ********************************** COLLECT, PRINT, LOAD BUTTON ACTIONS *********************************************
     ********************************************************************************************************************/

    /*************** COLLECT SAMPLE - SONSOR AND MODEL DATA - STORE IN GSHEET AND ADD TO NN TRAINING OBJECT *****************/
    $('#collect-inhale').click(function() {
        //how many samples for this set?
        //this flag is applied in the bluetooth data notification function
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 1;
        console.log("Collect btn NNInhale #samples flag: " + getSamplesFlag);

        numSets = numSets + 1;
    });

    $('#collect-exhale').click(function() {
        //how many samples for this set?
        //this flag is applied in the bluetooth data notification function
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 2;
        console.log("Collect btn NNExhale #samples flag: " + getSamplesFlag);

        numSets = numSets + 1;
    });

    $('#collect-hold').click(function() {
        //how many samples for this set?
        //this flag is applied in the bluetooth data notification function
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 3;
        console.log("Collect btn NNHold #samples flag: " + getSamplesFlag);

        numSets = numSets + 1;
    });


    $('#clear-inhale').click(function() {
        NNInhaleDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        updateSampleCountDisplay();
        $("#dump-print").html("");
        console.log("Clear NNInhaleDataArray");
    });
    $('#clear-exhale').click(function() {
        NNExhaleDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        updateSampleCountDisplay();
        $("#dump-print").html("");
        console.log("Clear NNExhaleDataArray");
    });
        $('#clear-exhale').click(function() {
        NNHoldDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        updateSampleCountDisplay();
        $("#dump-print").html("");
        console.log("Clear NNHoldDataArray");
    });

    //print sensor data to browser at bottom of app screen
    $('#print-btn').click(function() {
        console.log("print button");

        $("#dump-print").html(JSON.stringify(sensorDataSession));
        $("#dump-print").addClass("active-print");
        console.log("SENSOR SESSIONS DATA: " + sensorDataSession);
    });

    //load data from js file (JSON or JS object) into sensor session data
    $('#load-btn').click(function() {
        console.log("load button");
        //  sensorDataSession = exportedSensorData;
        NNInhaleDataArray = importedTrueData;
        NNExhaleDataArray = importedFalseData;
    });


    $('#export-btn').click(function() {
        console.log("export1 NN button");
        //clear everything but key values from stored NN
        neuralNet.clear();

        //export optimized weights and activation function
        var standalone = neuralNet.standalone();

        //convert to string for parsing
        standalone = standalone.toString();

        console.log(standalone);
        $("#dump-print").html(standalone);
        $("#dump-print").addClass("active-print");
    });


    //Send target configuration for pre-trained neural networks on device
    $('#configure-device').click(function() {
        sendCommandFlag = true;
    });

}); // end on document load
//}

function createLungAnimation(){

    //disable automatic lung animation
    $(".body-breathing").removeClass("auto");

    var boxframes = [
    { 
        transform: 'translateX(0)',
        background: 'red',
        borderRadius: 0
    },
    { 
        transform: 'translateX(45vw) scale(.5)', 
        background: 'orange',
        borderRadius: 0
    },
    {
        transform: 'translateX(90vw)',
        background: 'green',
        borderRadius: '50%'
    }
];



boxref = document.getElementById("box-test");
scrubber = document.getElementById("scrubber");
var animationlength = 10000;
var reqanimationreference;
var boxanimation = boxref.animate(boxframes, {
    duration: animationlength,
    fill: 'both',
    easing: 'ease-in'
});

boxanimation.pause();
cancelAnimationFrame(reqanimationreference);

lungShadowsBreathing = document.querySelector('.lung-shadows-breathing').animate(
  [
    {
      offset: 0,
      opacity: 0.6
    },
    {
      offset: 0.5,

      opacity:1
    },
    {
      offset: 1,
      opacity: 0.6
    }
  ],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright4 = document.querySelector('.breathing-right-bits img.lung-bit-4').animate(
  [
    {
        offset: 0,
        transform: "rotate(-2.5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(-1.5deg)",
     //   height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 1,
        transform: "rotate(-2.5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright3 = document.querySelector('.breathing-right-bits img.lung-bit-3').animate(
  [
    {
        offset: 0,
        transform: "rotate(-4.5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(-3.5deg)",
     //   height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 1,
        transform: "rotate(-4.5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright2 = document.querySelector('.breathing-right-bits img.lung-bit-2').animate(
[
    {
        offset: 0,
        transform: "rotate(-3deg)",
        height: "94%",
        transformOrigin: "left 29.6%",
    },
    {
        offset: 0.5,
      //  transform: "rotate(-2deg)",
      //  height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 1,
        transform: "rotate(-3deg)",
        height: "94%",
        transformOrigin: "left 29.6%",
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright1 = document.querySelector('.breathing-right-bits img.lung-bit-1').animate(
[
    {
        offset: 0,
        transform: "rotate(-5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
      //  transform: "rotate(-4deg)",
      //  height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"

    },
    {
        offset: 1,
        transform: "rotate(-5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft4 = document.querySelector('.breathing-left-bits img.lung-bit-4').animate(
[
    {
        offset: 0,
        transform: "rotate(2.5deg)",
        height: "94%",
        transformOrigin: "right 41.86%"
    },
    {
        offset: 0.5,
      //  transform: "rotate(1.5deg)",
      //  height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 41.86%"
    },
    {
        offset: 1,
        transform: "rotate(2.5deg)",
        height: "94%",
        transformOrigin: "right 41.86%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft3 = document.querySelector('.breathing-left-bits img.lung-bit-3').animate(
[
    {
        offset: 0,
        transform: "rotate(4.5deg)",
        height: "94%",
        transformOrigin: "right 30.6%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(3.5deg)",
     //   height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 30.6%"
    },
    {
        offset: 1,
        transform: "rotate(4.5deg)",
        height: "94%",
        transformOrigin: "right 30.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft2 = document.querySelector('.breathing-left-bits img.lung-bit-2').animate(
[
    {
        offset: 0,
        transform: "rotate(3deg)",
        height: "94%",
        transformOrigin: "right 41.2%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(2deg)",
     //   height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 41.2%"
    },
    {
        offset: 1,
        transform: "rotate(3deg)",
        height: "94%",
        transformOrigin: "right 41.2%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft1 = document.querySelector('.breathing-left-bits img.lung-bit-1').animate(
[
    {
        offset: 0,
        transform: "rotate(5deg)",
        height: "94%",
        transformOrigin: "right 39%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(4deg)",
     //   height: "98%",

        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 39%"
    },
    {
        offset: 1,
        transform: "rotate(5deg)",
        height: "94%",
        transformOrigin: "right 39%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


lungright = document.querySelector('.lung-right-breathing img').animate(
[
    {
        offset: 0,
        width: "92%",
        transform: "rotate(-4.5deg)"
    },
    {
        offset: 0.5,
      //  width: "96%", 
     //   transform: "rotate(-3.5deg)"

        width: "100%",
        transform: "rotate(0deg)"
    },
    {
        offset: 1,
        width: "92%",
        transform: "rotate(-4.5deg)"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


lungleft = document.querySelector('.lung-left-breathing img').animate(
[
    {
        offset: 0,
        width: "92%",
        transform: "rotate(4.5deg)"
    },
    {
        offset: 0.5,
      //  width: "96%", 
    //   transform: "rotate(3.5deg)"

        width: "100%",
        transform: "rotate(0deg)"
    },
    {
        offset: 1,
        width: "92%",
        transform: "rotate(4.5deg)"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


ciliaBreathing = document.querySelector('.cilia-breathing').animate(
[
    {
        offset: 0,
        top: "-12px"
    },
    {
        offset: 0.5,
       // top: "-10px"

        top: "-6px"
    },
    {
        offset: 1,
        top: "-12px"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);

/*
lungShadowsBreathing = document.querySelector('.lung-shadows-breathing').animate(
  [
    {
      offset: 0,
      opacity:1
    },
    {
      offset: 0.5,
      opacity: 0.6
    },
    {
      offset: 1,
      opacity:1
    }
  ],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright4 = document.querySelector('.breathing-right-bits img.lung-bit-4').animate(
  [
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(-1.5deg)",
     //   height: "98%",
        transform: "rotate(-2.5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright3 = document.querySelector('.breathing-right-bits img.lung-bit-3').animate(
  [
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(-3.5deg)",
     //   height: "98%",
        transform: "rotate(-4.5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright2 = document.querySelector('.breathing-right-bits img.lung-bit-2').animate(
[
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
      //  transform: "rotate(-2deg)",
      //  height: "98%",
        transform: "rotate(-3deg)",
        height: "94%",
        transformOrigin: "left 29.6%",
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsright1 = document.querySelector('.breathing-right-bits img.lung-bit-1').animate(
[
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    },
    {
        offset: 0.5,
      //  transform: "rotate(-4deg)",
      //  height: "98%",
        transform: "rotate(-5deg)",
        height: "94%",
        transformOrigin: "left 29.6%"

    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "left 29.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft4 = document.querySelector('.breathing-left-bits img.lung-bit-4').animate(
[
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 41.86%"
    },
    {
        offset: 0.5,
      //  transform: "rotate(1.5deg)",
      //  height: "98%",
        transform: "rotate(2.5deg)",
        height: "94%",
        transformOrigin: "right 41.86%"
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 41.86%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft3 = document.querySelector('.breathing-left-bits img.lung-bit-3').animate(
[
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 30.6%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(3.5deg)",
     //   height: "98%",
        transform: "rotate(4.5deg)",
        height: "94%",
        transformOrigin: "right 30.6%"
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 30.6%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft2 = document.querySelector('.breathing-left-bits img.lung-bit-2').animate(
[
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 41.2%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(2deg)",
     //   height: "98%",
        transform: "rotate(3deg)",
        height: "94%",
        transformOrigin: "right 41.2%"
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 41.2%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


bitsleft1 = document.querySelector('.breathing-left-bits img.lung-bit-1').animate(
[
    {
        offset: 0,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 39%"
    },
    {
        offset: 0.5,
     //   transform: "rotate(4deg)",
     //   height: "98%",
        transform: "rotate(5deg)",
        height: "94%",
        transformOrigin: "right 39%"
    },
    {
        offset: 1,
        transform: "rotate(0deg)",
        height: "101%",
        transformOrigin: "right 39%"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


lungright = document.querySelector('.lung-right-breathing img').animate(
[
    {
        offset: 0,
        width: "100%",
        transform: "rotate(0deg)"
    },
    {
        offset: 0.5,
      //  width: "96%", 
     //   transform: "rotate(-3.5deg)"
        width: "92%",
        transform: "rotate(-4.5deg)"
    },
    {
        offset: 1,
        width: "100%",
        transform: "rotate(0deg)"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


lungleft = document.querySelector('.lung-left-breathing img').animate(
[
    {
        offset: 0,
        width: "100%",
        transform: "rotate(0deg)"
    },
    {
        offset: 0.5,
      //  width: "96%", 
    //   transform: "rotate(3.5deg)"
        width: "92%",
        transform: "rotate(4.5deg)"
    },
    {
        offset: 1,
        width: "100%",
        transform: "rotate(0deg)"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);


ciliaBreathing = document.querySelector('.cilia-breathing').animate(
[
    {
        offset: 0,
        top: "-6px"
    },
    {
        offset: 0.5,
       // top: "-10px"
        top: "-12px"
    },
    {
        offset: 1,
        top: "-6px"
    }
],
  {
    iterations: Infinity,
    duration: 10000
  }
);

*/

scrubber.addEventListener('input', ()=>{
    boxanimation.currentTime = scrubber.value * animationlength;
    boxanimation.pause();

    ciliaBreathing.currentTime = scrubber.value * animationlength;
    lungleft.currentTime = scrubber.value * animationlength;
    lungright.currentTime = scrubber.value * animationlength;
    bitsleft1.currentTime = scrubber.value * animationlength;
    bitsleft2.currentTime = scrubber.value * animationlength;
    bitsleft3.currentTime = scrubber.value * animationlength;
    bitsleft4.currentTime = scrubber.value * animationlength;
    bitsright1.currentTime = scrubber.value * animationlength;
    bitsright2.currentTime = scrubber.value * animationlength;
    bitsright3.currentTime = scrubber.value * animationlength;
    bitsright4.currentTime = scrubber.value * animationlength;
    lungShadowsBreathing.currentTime = scrubber.value * animationlength;

    cancelAnimationFrame(reqanimationreference);
});


boxanimation.onfinish =(()=>{
  cancelAnimationFrame(reqanimationreference);
  scrubber.value = animationlength/animationlength;
});
}




