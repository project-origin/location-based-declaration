let EMISSION_DATA;
let FUEL_DATA;
let REFERENCES;

let API_HOST = 'https://api.eloverblik.dk';
let NUM_DIGITS_MEGA_CONVERT = 6;
let NUM_DIGITS_TON_CONVERT = 6;
let CHUNK_SIZE = 10;

let CONNECTED_AREAS = [
    'DK1',
    'DK2',
    'GE',
    'NO',
    'SE',
    'NL'
]

let FUEL_TYPES = {
    'Vind': {
        image: './images/wind.png',
        color: '#00a98f'
    },
    'Sol': {
        image: './images/solar.png',
        color: '#a0ffc8'
    },
    'Vandkraft': {
        image: './images/hydro.png',
        color: '#0a515d'
    },
    'Biomasse': {
        image: './images/biomass.png',
        color: '#ffd424'
    },
    'Affald': {
        image: './images/waste.png',
        color: '#fcba03'
    },
    'Naturgas': {
        image: './images/naturalgas.png',
        color: '#a0c1c2'
    },
    'Kul og Olie': {
        image: './images/coal.png',
        color: '#333333'
    },
    'Atomkraft': {
        image: './images/nuclear.png',
        color: '#ff6600'
    }
};

let EMISSION_TYPES = {
    'CO2': {
        html: 'CO<sub>2</sub> (Kuldioxid - drivhusgas)',
        unit: 'g',
        numDecimals: 2,
        type: 'air'
    },
    'CH4': {
        html: 'CH<sub>4</sub> (Metan - drivhusgas)',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'N2O': {
        html: 'N<sub>2</sub>O (Lattergas - drivhusgas)',
        unit: 'mg',
        numDecimals: 3,
        type: 'air'
    },
    'CO2Eqv': {
        html: 'CO<sub>2</sub>-ækvivalenter i alt',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'SO2': {
        html: 'SO<sub>2</sub> (Svovldioxid)',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'NOx': {
        html: 'NO<sub>x</sub> (Kvælstofilte)',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'CO': {
        html: 'CO (Kulilte)',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'NMvoc': {
        html: 'NM<sub>VOC</sub> (Uforbrændt kulbrinter)',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'Particles': {
        html: 'Partikler',
        unit: 'mg',
        numDecimals: 2,
        type: 'air'
    },
    'CoalFlyAsh': {
        html: 'Kulflyveaske',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    },
    'CoalSlag': {
        html: 'Kulslagge',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    },
    'Desulp': {
        html: 'Afsvovlingsprodukter (Gips)',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    },
    'WasteSlag': {
        html: 'Slagge (affaldsforbrænding)',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    },
    'FuelGasWaste': {
        html: 'RGA (røggasaffald)',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    },
    'Bioash': {
        html: 'Bioaske',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    },
    'RadioactiveWaste': {
        html: 'Radioaktivt affald (mg/kWh)',
        unit: 'g',
        numDecimals: 2,
        type: 'residual'
    }
};

$(document).ready(function() {
    $("#input-token").keypress(function(event) {
        if (event.keyCode === 13) { // click on Enter
            $("#button-calculate").click();
        }
    });
});

function loadEmissionData(year) {
    $.ajax({
        type: "GET",
        url: `./data/${year}_emission_data.json`,
        dataType: "json"
    }).done(function(data) {
        EMISSION_DATA = data;
    });
}

function loadFuelData(year) {
    $.ajax({
        type: "GET",
        url: `./data/${year}_fuel_data.json`,
        dataType: "json"
    }).done(function(data) {
        FUEL_DATA = data;
    });
}

function loadReferences(year) {
    $.ajax({
        type: "GET",
        url: `./data/${year}_references.json`,
        dataType: "json",
    }).done(function(data) {
        REFERENCES = data;
    })
}

function getAllMeasuringPointsIDAndArea(measuringPoints) {
    let ids = []

    for (var measuringPoint of measuringPoints) {
        if (measuringPoint['typeOfMP'] !== 'E17' || measuringPoint['settlementMethod'] === 'E01')
            continue

        let area = parseInt(measuringPoint['postcode']) >= 5000 ? 'DK1' : 'DK2';

        ids.push({
            id: measuringPoint['meteringPointId'],
            area: area
        });
    }
    return ids;
}

function extractHours(period) {
    let kWhHourly = [];

    for (var elem of period) {
        for (var point of elem['Point']) {
            kWhHourly.push(parseFloat(point['out_Quantity.quantity']))
        }
    }

    return kWhHourly;
}

function calculateEmissionStats(kWhHourly, stats, area, offsetStartFrom) {
    let areaEmissionData = EMISSION_DATA[area]

    for (var emissionType of Object.keys(EMISSION_TYPES)) {
        if (emissionType === 'CO2Eqv') // this value is computed so we skip it.
            continue;

        for (var i = 0; i < kWhHourly.length && i + offsetStartFrom < areaEmissionData[emissionType].length; i++) {
            stats[emissionType] += areaEmissionData[emissionType][i + offsetStartFrom]['PerkWh'] * kWhHourly[i]
        }
    }
}

function calculateFuelStats(kWhHourly, stats, area, offsetStartFrom) {
    let areaFuelData = FUEL_DATA[area];

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        for (var connectedArea of CONNECTED_AREAS) {

            for (var i = 0; i < kWhHourly.length && i + offsetStartFrom < areaFuelData[fuelType][connectedArea].length; i++) {
                let kWh = areaFuelData[fuelType][connectedArea][i + offsetStartFrom]['Share'] * kWhHourly[i]

                stats['Total_kWh'] += kWh
                stats[area] += kWh
                stats[fuelType][connectedArea] += kWh
            }
        }
    }
}

function retrieveTimeSeries(measuringPointIDsAndArea, year, dataAccessToken) {
    let ids = measuringPointIDsAndArea.map(function(A) {
        return A.id;
    })

    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/MeterData/GetTimeSeries/${year}-01-01/${year + 1}-01-01/Hour`,
        type: 'POST',
        data: JSON.stringify({
            "meteringPoints": {
                "meteringPoint": ids
            }
        }),
        dataType: 'json',
        contentType: 'application/json',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + dataAccessToken);
        }
    });
}

function retrieveMeasuringPoints(dataAccessToken) {
    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/meteringpoints/meteringpoints?includeAll=false`,
        type: 'GET',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + dataAccessToken);
        }
    });
}

function retrieveDataAccessToken(refreshToken) {
    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/Token`,
        type: 'GET',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + refreshToken);
        }
    });
}

function formatAddress(element) {
    var address = element['streetName'];

    if (element['buildingNumber'])
        address += " " + element['buildingNumber'];
    if (element['floorId'])
        address += ", " + element['floorId'];
    if (element['roomId'] && element['floorId'])
        address += " " + element['roomId'];
    else if (element['roomId'])
        address += ", " + element['roomId'];

    return address;
}

function buildConsumerTable(cvrs) {
    let cvrTable = $('#table-cvr-data');
    cvrTable.empty('*');

    for (var cvr of cvrs.values()) {
        let elements = cvr.split('*');
        cvrTable.append(`<tr><td class="h4">${elements[0]}</td><td class="h4">${elements[1]}</td></tr>`);
    }
}

function buildMeteringPointTable(mps) {
    let mpTable = $('.table-mp-data');
    mpTable.empty();

    for (var mp of mps.values()) {
        let elements = mp.split('*');

        mpTable.append(`<tr><td>${elements[0]}</td><td>${elements[1]}</td><td>${elements[2]}</td><td>${elements[3]}</td><td class="${elements[0]}-status">${elements[4]}</td></tr>`);
    }
}

function buildMasterDataTables(data) {
    let cvrs = new Set();
    let mps = new Set();

    for (var elem of data) {
        cvrs.add(elem['consumerCVR'] + '*' +
            elem['firstConsumerPartyName']);

        let type = (elem['typeOfMP'] !== 'E17' || elem['settlementMethod'] === 'E01') ? 'Ekskluderet (Produktion)' : 'Henter data <img src="https://energinet.dk/resources/images/bx_loader.gif" width="20" height="20">'

        mps.add(elem['meteringPointId'] + '*' +
            formatAddress(elem) + '*' +
            elem['postcode'] + '*' +
            elem['cityName'] + '*' +
            type);
    }

    buildConsumerTable(cvrs);
    buildMeteringPointTable(mps);

    $('.master-data-sector').removeAttr('hidden');

}

function getEmissionValue(emissionType, stats) {
    if (emissionType === 'CO2Eqv') {
        return stats['CO2'] + (stats['CH4'] * 28) / 1000 + (stats['N2O'] * 265) / 1000
    }

    if (EMISSION_TYPES[emissionType]['unit'] === 'g') {
        return stats[emissionType];
    } else if (EMISSION_TYPES[emissionType]['unit'] === 'mg') {
        return stats[emissionType] / 1000;
    } else {
        throw 'Unknown unit type';
    }
}

function buildEmissionTable(stats, totalkWh, DK1kWh, DK2kWh) {
    let table = $('#table-emissions');
    table.empty();

    let dk1Part = DK1kWh / totalkWh;
    let dk2Part = DK2kWh / totalkWh;

    var airRows = '';
    var residualRows = '';

    for (var emissionType of Object.keys(EMISSION_TYPES)) {
        let value = getEmissionValue(emissionType, stats)
        let ref_value = parseFloatAccordingToLocale(dk1Part * REFERENCES['emission'][emissionType]['ref_dk1'] +
            dk2Part * REFERENCES['emission'][emissionType]['ref_dk2'], (emissionType === 'N2O') ? 3 : 2);

        var html = ''
        if (emissionType === 'CO2Eqv') {
            html = `<tr>
              <td class="text-start"><em>${EMISSION_TYPES[emissionType]['html']}</em></td>
              <td class="text-center"><em>${parseFloatAccordingToLocale(value / totalkWh, EMISSION_TYPES[emissionType]['numDecimals'])}</em></td>
              <td class="text-end text-secondary"><em>${ref_value}</em></td>
              </tr>`
        } else {
            html = `<tr>
            <td class="text-start">${EMISSION_TYPES[emissionType]['html']}</td>
            <td class="text-center">${parseFloatAccordingToLocale(value / totalkWh, EMISSION_TYPES[emissionType]['numDecimals'])}</td>
             <td class="text-end text-secondary">${ref_value}</td>
            </tr>`
        }

        if (EMISSION_TYPES[emissionType]['type'] === 'air') {
            airRows += html;
        } else if (EMISSION_TYPES[emissionType]['type'] === 'residual') {
            residualRows += html;
        } else {
            throw 'Unknown type. Must be air or residual'
        }
    }

    table.append('<tr><td class="text-start"><strong>Emissioner til luften</strong></td><td  class="text-center" colspan="2"><strong>g/kWh</strong></td></tr>')
    table.append(airRows);
    table.append('<tr><td class="text-start"><strong>Restprodukter</strong></td><td  class="text-center" colspan="2"><strong>g/kWh</strong></td></tr>')
    table.append(residualRows);
}

function initFuelStats() {
    let stats = {
        Total_kWh: 0,
        DK1: 0,
        DK2: 0
    };

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        stats[fuelType] = {};
        for (var connectedArea of CONNECTED_AREAS) {
            stats[fuelType][connectedArea] = 0;
        }
    }

    return stats;
}

function initEmissionStats() {
    let stats = {};

    for (var emissionType of Object.keys(EMISSION_TYPES)) {
        stats[emissionType] = 0;
    }

    return stats;
}

function parseFloatAccordingToLocale(number, numDecimals = 2) {
    return parseFloat(number.toFixed(numDecimals)).toLocaleString('da-DK', {
        minimumFractionDigits: numDecimals
    });
}

function findAreaFromID(id, array) {
    for (var item of array) {
        if (id === item['id']) {
            return item['area'];
        }
    }
    return undefined;
}

function findOffsetStartFrom(period) {
    if (period.length < 1)
        throw 'Period contained no values';

    var start = period[0]['timeInterval']['start'];
    start = start.substring(0, start.length - 1);

    for (var i = 0; i < FUEL_DATA['DK1']['Vind']['DK1'].length; i++) {
        if (start === FUEL_DATA['DK1']['Vind']['DK1'][i]['HourUTC'])
            return i;
    }

    throw 'Timeslot was not found';
}

function processTimesSeries(timeseries, id, measuringPointsIDAndArea, fuelStats, emissionStats) {
    if (timeseries.length == 0 || timeseries[0]['businessType'] !== 'A04') {
        $(`.${id}-status`).text('Ikke time opgjort');
        return;
    }

    let period = timeseries[0]['Period'];
    let offsetStartFrom = findOffsetStartFrom(period);
    let kWhHourly = extractHours(period);
    let area = findAreaFromID(id, measuringPointsIDAndArea);

    calculateFuelStats(kWhHourly, fuelStats, area, offsetStartFrom);
    calculateEmissionStats(kWhHourly, emissionStats, area, offsetStartFrom);

    $(`.${id}-status`).text('Inkluderet');
}

function processMeasuringPoints(measuringPoints, year, dataAccessToken) {
    $('#label-status').html('Fremstiller din deklarationen. Vent venligst <img src="https://energinet.dk/resources/images/bx_loader.gif" width="25" height="25">');
    measuringPointsIDAndArea = getAllMeasuringPointsIDAndArea(measuringPoints);

    var downloaded = 0;
    $('#download-status').text(`Hentet ${downloaded}/${measuringPointsIDAndArea.length} målere.`);

    let fuelStats = initFuelStats();
    let emissionStats = initEmissionStats();
    let apiCallList = [];

    for (var i = 0; i < measuringPointsIDAndArea.length; i += CHUNK_SIZE) {

        let slice = measuringPointsIDAndArea.slice(i, i + CHUNK_SIZE);

        apiCallList.push(retrieveTimeSeries(slice, year, dataAccessToken).then(function(data) {
            let result = data['result'];
            for (var j = 0; j < result.length; j++) {
                let timeseries = result[j]['MyEnergyData_MarketDocument']['TimeSeries'];
                let id = result[j]['id'];

                processTimesSeries(timeseries, id, measuringPointsIDAndArea, fuelStats, emissionStats);
            }

            downloaded += slice.length;
            $('#download-status').text(`Hentet ${downloaded}/${measuringPointsIDAndArea.length} målere.`);
        }));
    }

    Promise.all(apiCallList).then(function() {
        if (fuelStats['Total_kWh'] === 0) {
            $('#label-status').text('Der er ikke registreret timeforbrug på dine målere.');
        } else {
            buildEmissionFuelPage(fuelStats, emissionStats);
        }

        $("#button-calculate").removeAttr("disabled");

    }).catch(function(error) {
        $('#label-status').text('Noget gik galt. Kunne ikke beregne miljødeklarationen. Prøv igen eller kontakt administratoren.');
        console.log(error)
        $("#button-calculate").removeAttr("disabled");
    });
}

function clear_data() {
    $('.master-data-sector').attr('hidden', true);
    $('.emission-data-sector').attr('hidden', true);

    $('#label-master-data').text('');
    $('#label-emission-data').text('');
}

function formatPolutionAmount(amount) {
    let unit;
    let actualAmount;

    if (amount >= Math.pow(10, NUM_DIGITS_TON_CONVERT)) {
        unit = 't';
        actualAmount = (amount / Math.pow(10, 6));
    } else {
        unit = 'kg';
        actualAmount = (amount / Math.pow(10, 3));
    }

    return parseFloatAccordingToLocale(actualAmount, 2) + ' ' + unit;
}

function buildEmissionFuelPage(fuelStats, emissionStats) {
    $('#label-status').text('');

    buildEmissionTable(emissionStats, fuelStats['Total_kWh'], fuelStats['DK1'], fuelStats['DK2']);
    buildBarChart(fuelStats);
    buildGaugeChart(fuelStats);
    buildIndicatorGaugeChart(emissionStats, fuelStats);
    buildFuelTable(fuelStats);
    buildConnectedAreaTable(fuelStats);

    $('#num-co2-total').text(formatPolutionAmount(emissionStats['CO2']));
    $('#num-co2-relative').text(parseFloatAccordingToLocale((emissionStats['CO2'] / fuelStats['Total_kWh'])) + ' g/kWh');

    $('.emission-data-sector').removeAttr('hidden');
}

function loadData(year) {
    return Promise.all([
        loadEmissionData(year),
        loadFuelData(year),
        loadReferences(year),
    ]);
}

function computeDeclaration() {
    clear_data();
    $("#button-calculate").attr("disabled", "disabled");
    let year = parseInt($("#input-year").val());

    $('#title-year').text(year);

    let refreshToken = $('#input-token').val();

    $('#label-status').html('Fremsøger din stamdata. Vent venligst <img src="https://energinet.dk/resources/images/bx_loader.gif" width="20" height="20">');

    loadData(year).then(function() {
        retrieveDataAccessToken(refreshToken).then(function(data) {
            let dataAccessToken = data['result'];

            retrieveMeasuringPoints(dataAccessToken).then(function(data) {
                let measuringPoints = data['result'];

                $('#label-master-data').text('Forbrugsstamdata');

                buildMasterDataTables(measuringPoints);

                processMeasuringPoints(measuringPoints, year, dataAccessToken);

            }).catch(function() {
                $('#label-status').text('Noget gik galt. Kunne ikke hente forbrugsdata. Prøv igen eller kontakt administratoren.');
                $("#button-calculate").removeAttr("disabled");
            });
        }).catch(function() {
            $('#label-status').text('Noget gik galt. Venligst sikrer dig at din token er valid.');
            $("#button-calculate").removeAttr("disabled");
        });
    });
}

function sumConnectedAreas(consumedFromConnectedArea) {
    var sum = 0;
    for (var connectedArea of CONNECTED_AREAS) {
        sum += consumedFromConnectedArea[connectedArea];
    }

    return sum;
}

function buildBarChart(fuelStats) {
    var ctx = document.getElementById('barChart').getContext('2d');
    var labels = [];
    var values = [];
    var colors = [];

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        if (fuelType !== 'Total_kWh') {
            labels.push(fuelType);
            values.push(sumConnectedAreas(fuelStats[fuelType]));
            colors.push(FUEL_TYPES[fuelType]['color']);
        }
    }

    var chart = new Chart(ctx, {
        type: 'outlabeledPie',
        data: {
            labels: labels,
            datasets: [{
                label: '',
                data: values,
                backgroundColor: colors
            }]
        },
        options: {
            maintainAspectRatio: false,
            legend: {
                display: false,
                align: 'center',
                position: 'bottom'
            },
            animation: {
                duration: 200
            },
            tooltips: {
                enabled: true,
                callbacks: {
                    label: function(tooltipItem, data) {
                        return data.labels[tooltipItem.index].toString() +
                            ': ' +
                            formatEnergyAmount(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index], fuelStats['Total_kWh']);
                    }
                }
            }
        }
    });
}

function buildGaugeChart(fuelStats) {
    let element = document.querySelector('#gauge-green-meter');
    $('#gauge-green-meter').empty();

    let sustainablePercentage = sustainableEnergyPercentage(fuelStats);

    let gaugeOptions = {
        hasNeedle: true,
        needleColor: 'gray',
        needleUpdateSpeed: 0,
        arcColors: ['green', 'black'],
        arcDelimiters: [sustainablePercentage],
        rangeLabel: ['0%', '100%'],
        needleStartValue: sustainableEnergyPercentage(fuelStats),
        centralLabel: sustainablePercentage + '%',
    };

    GaugeChart.gaugeChart(element, 300, gaugeOptions).updateNeedle(sustainablePercentage);
}

function buildIndicatorGaugeChart(emissionStats, fuelStats) {
    let element = document.querySelector('#gauge-indicator-meter');
    $('#gauge-indicator-meter').empty();

    let totalkWh = fuelStats['Total_kWh'];
    let dk1Part = fuelStats['DK1'] / totalkWh;
    let dk2Part = fuelStats['DK2'] / totalkWh;

    let CO2 = emissionStats['CO2'] / totalkWh;

    let reference = dk1Part * REFERENCES['emission']['CO2']['ref_dk1'] + dk2Part * REFERENCES['emission']['CO2']['ref_dk2'];

    var value = 100 - (CO2 / reference) * 100;

    let gaugeOptions = {
        hasNeedle: true,
        needleColor: 'gray',
        needleUpdateSpeed: 0,
        arcColors: ['black', '#ADD8E6', 'green'],
        arcDelimiters: [45, 55],
        rangeLabel: ['Mere CO\u2082', 'Mindre CO\u2082'],
        needleStartValue: value,
        centralLabel: parseFloatAccordingToLocale(value * -1) + '%',
    };

    let multiplied = 5 * value;
    let needleValue = (multiplied > 50) ? 100 : (multiplied < -50) ? 0 : multiplied;

    GaugeChart.gaugeChart(element, 300, gaugeOptions).updateNeedle(50 + needleValue);

}

function getProcentwiseOfTotal(amount, totalAmount) {
    return parseFloatAccordingToLocale((amount * 100) / totalAmount);
}

function buildFuelTable(fuelStats) {
    let table = $('#table-fuels');
    table.empty();

    let totalkWh = fuelStats['Total_kWh'];
    let dk1Part = fuelStats['DK1'] / totalkWh;
    let dk2Part = fuelStats['DK2'] / totalkWh;

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        if (fuelType !== 'Total_kWh') {
            let consumed = sumConnectedAreas(fuelStats[fuelType]);
            let ref_value = dk1Part * REFERENCES['fuel'][fuelType]['ref_dk1'] + dk2Part * REFERENCES['fuel'][fuelType]['ref_dk2'];
            table.append(`<tr>
                    <td style="background-color:${FUEL_TYPES[fuelType]['color']};"><img src="${FUEL_TYPES[fuelType]['image']}" width="30" height="30"></td>
                    <td>${fuelType}</td>
                    <td class="text-end">${formatEnergyAmount(consumed, totalkWh)}</td>
                    <td class="text-end">${getProcentwiseOfTotal(consumed, totalkWh)}%</td>
                    <td class="text-end text-secondary">${parseFloatAccordingToLocale(ref_value, 2)}%</td>
                    </tr>`);
        }
    }

    table.append(`<tr><td></td><td class='h4' colspan="2">Total forbrug</td><td class='h4' colspan="2">${formatEnergyAmount(totalkWh, totalkWh)}</td></tr>`);
}

function sumFuelsAccordingToConnectedArea(fuelStats, connectedArea) {
    var sum = 0;
    for (var fuelType of Object.keys(FUEL_TYPES)) {
        sum += fuelStats[fuelType][connectedArea];
    }

    return sum;
}

function buildConnectedAreaTable(fuelStats) {
    let table = $('#table-from-production');
    table.empty();

    let totalkWh = fuelStats['Total_kWh'];

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        if (fuelType !== 'Total_kWh') {
            let consumed = sumConnectedAreas(fuelStats[fuelType]);

            var rows = ``;
            for (var connectedArea of CONNECTED_AREAS) {
                rows += `<td class="text-end">${getProcentwiseOfTotal(fuelStats[fuelType][connectedArea], totalkWh)}%</td>`
            }

            table.append(`<tr>
                    <td class="text-center" style="background-color:${FUEL_TYPES[fuelType]['color']};"><img src="${FUEL_TYPES[fuelType]['image']}" width="30" height="30"></td>
                    <td>${fuelType}</td>
                    ${rows}
                    <td class="text-end"><strong>${getProcentwiseOfTotal(consumed, totalkWh)}%</strong></td>
                    </tr>`);
        }
    }

    var rows = ``;
    for (var connectedArea of CONNECTED_AREAS) {
        rows += `<td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, connectedArea), totalkWh)}%</strong></td>`;
    }
    table.append(`<tr>
                <td></td>
                <td><strong>Total</strong></td>
                ${rows}
                <td class="text-end"><strong>100.00%</strong></td>
                </tr>`);
}

function formatEnergyAmount(amountkWh, totalAmountKwH) {
    let unit;
    let actualAmount;

    if (totalAmountKwH >= Math.pow(10, NUM_DIGITS_MEGA_CONVERT)) {
        unit = 'MWh';
        actualAmount = (amountkWh / Math.pow(10, 3));
    } else {
        unit = 'kWh';
        actualAmount = amountkWh;
    }

    return parseFloatAccordingToLocale(actualAmount, 0) + ' ' + unit;
}

function sustainableEnergyPercentage(fuelStats) {
    let total = fuelStats['Total_kWh'];
    let greenEnergy = sumConnectedAreas(fuelStats['Sol']) +
        sumConnectedAreas(fuelStats['Vind']) +
        sumConnectedAreas(fuelStats['Vandkraft']) +
        sumConnectedAreas(fuelStats['Biomasse']) +
        sumConnectedAreas(fuelStats['Affald']) * 0.55;

    return Math.round(greenEnergy / total * 100);
}
