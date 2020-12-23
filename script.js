let EMISSION_TYPES;
let EMISSION_DATA;
let FUEL_DATA;

let API_HOST = 'https://api.eloverblik.dk';
let YEAR = '2019';
let NUM_DIGITS_BEFORE_MEGA = 7;

let CONNECTED_AREAS = [
    'NO',
    'NL',
    'GE',
    'SE',
    'DK2',
    'DK1'
]

let FUEL_TYPES = [
    'Vind',
    'Sol',
    'Vandkraft',
    'Biomasse',
    'Affald',
    'Naturgas',
    'Kul og Olie',
    'Atomkraft'
];

let COLORS = {
  'Vind': '#00a98f',
  'Sol': '#a0ffc8',
  'Vandkraft': '#0a515d',
  'Biomasse': '#ffd424',
  'Affald': '#fcba03',
  'Naturgas': '#a0c1c2',
  'Kul og Olie': '#333333',
  'Atomkraft': '#ff6600',

/**
  'Onshore': '#0a515d',
  'Offshore': '#0a515d',
  'Anden VE': '#0a515d',
  'marine': '#f29e1f',
  'Vandkraft': '#00a98f',
  'Solceller': '#ffd424',
  'biomass': '#a0cd92',
  'Biogas': '#293a4c',
  'Affald': '#a0c1c2',
  'Kul': '#333333',
  'Brunkul': '#333333',
  'Naturgas': '#a0ffc8',
  'Fuelolie': '#ff6600',
  'Gasolie': '#ff6600',
  'Atomkraft': '#8064a2',
  'Halm': '#fcba03',
  'Træ_mm': '#fcba03'
  */
};


$(document).ready(function() {
    loadData();

    $('#title_year').text(YEAR);
});

function loadData() {
    $.ajax({
        type: "GET",
        url: "data.json",
        dataType: "json"
    }).done(function(data) {
        EMISSION_TYPES = data['emission_types']
        EMISSION_DATA = data['emission_data']
        FUEL_DATA = data['fuel_data']
    });
}

function getAllMeasuringPointsIDAndArea(measuringPoints) {
    ids = []

    for (measuringPoint of measuringPoints) {
        if (measuringPoint['typeOfMP'] !== 'E17')
            continue

        area = parseInt(measuringPoint['postcode']) < 5000 ? 'DK2' : 'DK1';
        ids.push({
            id: measuringPoint['meteringPointId'],
            area: area
        });
    }
    return ids;
}

function processTimeSeries(period) {
    kWh_hourly = [];

    for (elem of period) {
        for (point of elem['Point']) {
            kWh_hourly.push(parseFloat(point['out_Quantity.quantity']))
        }
    }

    return kWh_hourly;
}

function calculateEmissionStats(kWh_hourly, stats) {
    area_emission_data = EMISSION_DATA[area]

    for (var i = 0; i < kWh_hourly.length; i++) {
        for (emission_type of EMISSION_TYPES) {
            stats[emission_type] += area_emission_data[emission_type][i]['PerkWh'] * kWh_hourly[i]
        }
        stats['Total_kWh'] += kWh_hourly[i]
    }
}

function calculateFuelStats(kWh_hourly, stats, area) {
    area_fuel_data = FUEL_DATA[area]

    for (var i = 0; i < kWh_hourly.length; i++) {
        for (fuelType of FUEL_TYPES) {
            for (connectedArea of CONNECTED_AREAS) {

                kWh = area_fuel_data[fuelType][connectedArea][i]['Share'] * kWh_hourly[i]

                stats['Total_kWh'] += kWh
                stats[fuelType][connectedArea] += kWh
            }
        }
    }
}

function retrieveTimeSeries(measuringPointIDAndArea, dataAccessToken) {
    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/MeterData/GetTimeSeries/${YEAR}-01-01/${YEAR}-12-31/Hour`,
        type: 'POST',
        data: JSON.stringify({
            "meteringPoints": {
                "meteringPoint": [measuringPointIDAndArea['id']]
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
    address = element['streetName']

    if (element['buildingNumber'])
        address += " " + element['buildingNumber']
    if (element['floorId'])
        address += ", " + element['floorId']
    if (element['roomId'])
        address += " " + element['roomId']
    else if (element['roomId'])
        address += ", " + element['roomId']

    return address;
}

function buildMasterDataTable(data) {
    cvrs = new Set()
    mps = new Set()

    for (let elem of data) {
        cvrs.add({
            cvr: elem['consumerCVR'],
            name: elem['firstConsumerPartyName']
        })

        mps.add({
            id: elem['meteringPointId'],
            address: formatAddress(elem),
            postcode: elem['postcode'],
            city: elem['cityName']
        })
    }

    var cvrTable = $('#table-cvr-data');
    cvrTable.empty();

    for (var cvr of cvrs.values()) {
        cvrTable.append(`<tr>
                        <td>${cvr['cvr']}</td>
                        <td>${cvr['name']}</td>
                     </tr>`
                 );
    }

    var mpTable = $('#table-mp-data');
    mpTable.empty();

    for (var mp of mps.values()) {
        mpTable.append(`<tr>
                        <td>${mp['id']}</td>
                        <td>${mp['address']}</td>
                        <td>${mp['postcode']}</td>
                        <td>${mp['city']}</td>
                     </tr>`
                 );
    }
}


function convertToPerkWh(emission_value, total_kWh) {
    return parseFloatAccordingToLocale((emission_value / total_kWh));
}

function generateEmissionTable(stats) {
    total_kWh = stats['Total_kWh']

    $("#Co2_value").text(parseFloatAccordingToLocale(stats['Co2'] / total_kWh));
    $("#CH4_value").text(parseFloatAccordingToLocale(stats['CH4'] / total_kWh));
    $("#N2O_value").text(parseFloatAccordingToLocale(stats['N2O'] / total_kWh));
    $("#SO2_value").text(parseFloatAccordingToLocale(stats['SO2'] / total_kWh));
    $("#NOx_value").text(parseFloatAccordingToLocale(stats['NOx'] / total_kWh));
    $("#CO_value").text(parseFloatAccordingToLocale(stats['CO'] / total_kWh));
    $("#NMvoc_value").text(parseFloatAccordingToLocale(stats['NMvoc'] / total_kWh));
    $("#Particles_value").text(parseFloatAccordingToLocale(stats['Particles'] / total_kWh));

    $("#FlyAsh_value").text(parseFloatAccordingToLocale(stats['FlyAsh'] / total_kWh));
    $("#Desulp_value").text(parseFloatAccordingToLocale(stats['Desulp'] / total_kWh));
    $("#Slag_value").text(parseFloatAccordingToLocale(stats['Slag'] / total_kWh));
    $("#Waste_value").text(parseFloatAccordingToLocale(stats['Waste'] / total_kWh));



}

function initFuelStats() {
    stats = {
        Total_kWh: 0
    };

    for (fuelType of FUEL_TYPES) {
        stats[fuelType] = {}
        for (connectedArea of CONNECTED_AREAS) {
            stats[fuelType][connectedArea] = 0
        }
    }

    return stats;
}

function initEmissionStats() {
    stats = {
        Total_kWh: 0
    };

    for (type of EMISSION_TYPES) {
        stats[type] = 0
    }

    return stats;
}

function parseFloatAccordingToLocale(number, numDecimals = 2) {
    return parseFloat(number.toFixed(numDecimals)).toLocaleString('da-DK', {minimumFractionDigits: numDecimals})
}

function processMeasuringPoints(measuringPoints, fuelStats, emissionStats) {
    $('#label-emission-data').text('Beregner miljødeklarationen...');
    measuringPointsIDAndArea = getAllMeasuringPointsIDAndArea(measuringPoints);

    var dfd = $.Deferred();
    var promise = dfd.promise()

    for (measuringPointIDAndArea of measuringPointsIDAndArea) {
        promise = promise.then(function() {
            return retrieveTimeSeries(measuringPointIDAndArea, dataAccessToken)
        }).then(function(data) {
            period = data['result'][0]['MyEnergyData_MarketDocument']['TimeSeries'][0]['Period'];

            kWh_hourly = processTimeSeries(period);

            calculateFuelStats(kWh_hourly, fuelStats, measuringPointIDAndArea['area'])
            calculateEmissionStats(kWh_hourly, emissionStats)
        });
    }

    dfd.resolve()

    return promise
}

function clear_data() {
    $('#data-sector').attr('hidden', true);
    $("#table-master-data tbody tr").empty();
    $('#gaugeArea').empty();
    $('#label-master-data').text('');
    $('#label-emission-data').text('');
}

function computeDeclaration(obj) {
    clear_data()

    let refreshToken = $('#input-token').val();

    $('#label-status').text('Fremstiller miljødeklarationen. Vent venligst...');

    retrieveDataAccessToken(refreshToken).then(function(data) {
        dataAccessToken = data['result'];

        retrieveMeasuringPoints(dataAccessToken).then(function(data) {
            measuringPoints = data['result'];

            $('#label-master-data').text('Forbrugsstamdata');

            buildMasterDataTable(measuringPoints);

            fuelStats = initFuelStats();
            emissionStats = initEmissionStats();
            processMeasuringPoints(measuringPoints, fuelStats, emissionStats).then(function() {
                $('#label-status').text('');

                console.log('fuelStats', fuelStats);
                console.log('emissionStats', emissionStats);

                generateEmissionTable(emissionStats);
                buildBarChart(fuelStats);
                buildGaugeChart(fuelStats);
                buildTechnologyTable(fuelStats);
                buildConnectedAreaTable(fuelStats)

                $('#co2Total').text(parseFloatAccordingToLocale((emissionStats['Co2'] / 1000)) + ' kg');
                $('#co2Relative').text(parseFloatAccordingToLocale((emissionStats['Co2'] / emissionStats['Total_kWh'])) + ' g/kWh');

                $('#data-sector').removeAttr('hidden');

            }).catch(function() {
                $('#label-status').text('Noget gik galt. Kunne ikke beregne miljødeklarationen. Prøv igen eller kontakt administratoren.');
            });

        }).catch(function() {
            $('#label-status').text('Noget gik galt. Kunne ikke hente forbrugsdata. Prøv igen eller kontakt administratoren.');
        });
    }).catch(function() {
        $('#label-status').text('Noget gik galt. Venligst sikrer dig at din token er valid.');
    });
}

function sumConnectedAreas(consumedFromConnectedArea) {
    sum = 0;
    for (connectedArea of CONNECTED_AREAS) {
        sum += consumedFromConnectedArea[connectedArea];
    }

    return sum;
}

function buildBarChart(fuelStats) {
    var ctx = document.getElementById('barChart').getContext('2d');
    var labels = [];
    var values = [];
    var colors = [];

    for(var technology in fuelStats) {
        if(technology != 'Total_kWh') {
            labels.push(technology);
            values.push(sumConnectedAreas(fuelStats[technology]));
            colors.push(COLORS[technology]);
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
                        return data.labels[tooltipItem.index].toString()
                            + ': '
                            + formatAmount(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index], fuelStats['Total_kWh']);
                    }
                }
            }
        }
    });
}


function buildGaugeChart(fuelStats) {
    let element = document.querySelector('#gaugeArea')
    let greenPercentage = greenEnergyPercentage(fuelStats)

    // Properties of the gauge
    let gaugeOptions = {
        hasNeedle: true,
        needleColor: 'gray',
        needleUpdateSpeed: 0,
        arcColors: ['green', 'black'],
        arcDelimiters: [greenPercentage],
        rangeLabel: ['0%', '100%'],
        needleStartValue: greenEnergyPercentage(fuelStats),
        centralLabel: greenPercentage + '% grøn',
    };

    GaugeChart.gaugeChart(element, 300, gaugeOptions).updateNeedle(greenPercentage)
}

function getProcentwiseOfTotal(amount, totalAmount) {
    return parseFloatAccordingToLocale((amount * 100) / totalAmount)
}

function buildTechnologyTable(fuelStats) {
    var table = $('#technologiesTable');
    table.empty();

    for(var technology of FUEL_TYPES) {
        if (technology != 'Total_kWh') {
            consumed = sumConnectedAreas(fuelStats[technology]);
            table.append(`<tr>
                             <td style="background-color:${COLORS[technology]};"></td>
                             <td>${technology}</td>
                             <td class="text-end">${formatAmount(consumed, fuelStats['Total_kWh'])}</td>
                             <td class="text-end">${getProcentwiseOfTotal(consumed, fuelStats['Total_kWh'])}%</td>
                         </tr>`);
        }
    }

    table.append(`<tr><td></td><td class='h4'>Total forbrug</td><td class='h4'>${formatAmount(fuelStats['Total_kWh'], fuelStats['Total_kWh'])}</td><td></td></tr>`)
}

function sumFuelsAccordingToConnectedArea(fuelStats, connectedArea) {
    sum = 0
    for(var technology of FUEL_TYPES) {
        sum += fuelStats[technology][connectedArea];
    }

    return sum;
}

function buildConnectedAreaTable(fuelStats) {
    var table = $('#connectedAreaTable');
    table.empty();

    for(var technology of FUEL_TYPES) {
        if (technology != 'Total_kWh') {
            consumed = sumConnectedAreas(fuelStats[technology]);
            table.append(`<tr>
                             <td style="background-color:${COLORS[technology]};"></td>
                             <td>${technology}</td>
                             <td class="text-end">${getProcentwiseOfTotal(fuelStats[technology]['DK1'], fuelStats['Total_kWh'])}%</td>
                             <td class="text-end">${getProcentwiseOfTotal(fuelStats[technology]['DK2'], fuelStats['Total_kWh'])}%</td>
                             <td class="text-end">${getProcentwiseOfTotal(fuelStats[technology]['GE'], fuelStats['Total_kWh'])}%</td>
                             <td class="text-end">${getProcentwiseOfTotal(fuelStats[technology]['NO'], fuelStats['Total_kWh'])}%</td>
                             <td class="text-end">${getProcentwiseOfTotal(fuelStats[technology]['SE'], fuelStats['Total_kWh'])}%</td>
                             <td class="text-end">${getProcentwiseOfTotal(fuelStats[technology]['NL'], fuelStats['Total_kWh'])}%</td>
                             <td class="text-end"><strong>${getProcentwiseOfTotal(consumed, fuelStats['Total_kWh'])}%</strong></td>
                         </tr>`);
        }
    }
    table.append(`<tr>
                    <td></td>
                    <td><strong>Total</strong></td>
                    <td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, 'DK1'), fuelStats['Total_kWh'])}%</strong></td>
                    <td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, 'DK2'), fuelStats['Total_kWh'])}%</strong></td>
                    <td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, 'GE'), fuelStats['Total_kWh'])}%</strong></td>
                    <td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, 'NO'), fuelStats['Total_kWh'])}%</strong></td>
                    <td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, 'SE'), fuelStats['Total_kWh'])}%</strong></td>
                    <td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, 'NL'), fuelStats['Total_kWh'])}%</strong></td>
                  </tr>`)
}


function formatAmount(amountkWh, totalAmountKwH) {
    let unit;
    let actualAmount;

    if(totalAmountKwH >= Math.pow(10, NUM_DIGITS_BEFORE_MEGA)) {
        unit = 'MWh';
        actualAmount = (amountkWh / Math.pow(10, 3));
    } else {
        unit = 'kWh';
        actualAmount = amountkWh;
    }

    return parseFloatAccordingToLocale(actualAmount, 0) + ' ' + unit;
}


function greenEnergyPercentage(fuelStats) {
    var total = fuelStats['Total_kWh'];
    var greenEnergy = sumConnectedAreas(fuelStats['Sol'])
                    + sumConnectedAreas(fuelStats['Vind'])
                    + sumConnectedAreas(fuelStats['Vandkraft'])

    return Math.round(greenEnergy / total * 100);
}
