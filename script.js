let EMISSION_TYPES;
let EMISSION_DATA;
let FUEL_DATA;

let API_HOST = 'https://api.eloverblik.dk';
let YEAR = 2019;
let NUM_DIGITS_MEGA_CONVERT = 7;
let CHUNK_SIZE = 10;

let CONNECTED_AREAS = [
    'DK1',
    'DK2',
    'GE',
    'NO',
    'SE',
    'NL'
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

let IMAGES = {
  'Vind': './images/wind.png',
  'Sol': './images/solar.png',
  'Vandkraft': './images/hydro.png',
  'Biomasse': './images/biomass.png',
  'Affald': './images/waste.png',
  'Naturgas': './images/naturalgas.png',
  'Kul og Olie': './images/coal.png',
  'Atomkraft': './images/nuclear.png',
}

let COLORS = {
  'Vind': '#00a98f',
  'Sol': '#a0ffc8',
  'Vandkraft': '#0a515d',
  'Biomasse': '#ffd424',
  'Affald': '#fcba03',
  'Naturgas': '#a0c1c2',
  'Kul og Olie': '#333333',
  'Atomkraft': '#ff6600',
};


$(document).ready(function() {
    loadData();

    $('#title_year').text(YEAR);

    $("#input-token").keypress(function(event) {
      if (event.keyCode === 13) {
        $("#button-calculate").click();
      }
    });
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
    let ids = []

    for (var measuringPoint of measuringPoints) {
        if (measuringPoint['typeOfMP'] !== 'E17')
            continue

        let area = parseInt(measuringPoint['postcode']) >= 5000 ? 'DK1' : 'DK2';

        ids.push({
            id: measuringPoint['meteringPointId'],
            area: area
        });
    }
    return ids;
}

function processTimeSeries(period) {
    let kWh_hourly = [];

    for (var elem of period) {
        for (var point of elem['Point']) {
            kWh_hourly.push(parseFloat(point['out_Quantity.quantity']))
        }
    }

    return kWh_hourly;
}

function calculateEmissionStats(kWh_hourly, stats, area) {
    let area_emission_data = EMISSION_DATA[area]

    for (var emission_type of EMISSION_TYPES) {
        var offset = area_emission_data[emission_type].length - kWh_hourly.length;
        if (offset < 0) offset = 0;
        for (var i = 0; i < kWh_hourly.length, i + offset < area_emission_data[emission_type].length; i++) {
            stats[emission_type] += area_emission_data[emission_type][i + offset]['PerkWh'] * kWh_hourly[i]
        }
    }
}

function calculateFuelStats(kWh_hourly, stats, area) {
    let area_fuel_data = FUEL_DATA[area];

    for (var fuelType of FUEL_TYPES) {
        for (var connectedArea of CONNECTED_AREAS) {
            var offset = area_fuel_data[fuelType][connectedArea].length - kWh_hourly.length;
            if (offset < 0) offset = 0;
            for (var i = 0; i < kWh_hourly.length, i + offset < area_fuel_data[fuelType][connectedArea].length; i++) {
                let kWh = area_fuel_data[fuelType][connectedArea][i + offset]['Share'] * kWh_hourly[i]

                stats['Total_kWh'] += kWh
                stats[fuelType][connectedArea] += kWh
            }
        }
    }
}

function retrieveTimeSeries(measuringPointIDsAndArea, dataAccessToken) {
    let ids = measuringPointIDsAndArea.map(function(A) {return A.id;})
    console.log("Not reversed = " + ids)
    let reversed = ids.reverse()
    console.log("Reversed = " + reversed)

    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/MeterData/GetTimeSeries/${YEAR}-01-01/${YEAR + 1}-01-01/Hour`,
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
    var address = element['streetName']

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
    let cvrs = new Set()
    let mps = new Set()

    console.log(data)

    for (var elem of data) {
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
                         </tr>`);
    }

    var mpTable = $('#table-mp-data');
    mpTable.empty();

    for (var mp of mps.values()) {
        mpTable.append(`<tr>
                        <td>${mp['id']}</td>
                        <td>${mp['address']}</td>
                        <td>${mp['postcode']}</td>
                        <td>${mp['city']}</td>
                        </tr>`);
    }
}


function convertToPerkWh(emission_value, total_kWh) {
    return parseFloatAccordingToLocale((emission_value / total_kWh));
}

function buildEmissionTable(stats, total_kWh) {
    $("#CO2_value").text(parseFloatAccordingToLocale(stats['CO2'] / total_kWh));
    $("#CH4_value").text(parseFloatAccordingToLocale(stats['CH4'] / 1000 / total_kWh));
    $("#N2O_value").text(parseFloatAccordingToLocale(stats['N2O'] / 1000 / total_kWh, 3));

    C02Eqv = (stats['CO2'] + (stats['CH4'] * 28) / 1000 + (stats['N2O'] * 265) / 1000 )

    $("#C02Eqv_value").text(parseFloatAccordingToLocale(C02Eqv / total_kWh));
    $("#SO2_value").text(parseFloatAccordingToLocale(stats['SO2'] / 1000 / total_kWh));
    $("#NOx_value").text(parseFloatAccordingToLocale(stats['NOx'] / 1000 / total_kWh));
    $("#CO_value").text(parseFloatAccordingToLocale(stats['CO'] / 1000 / total_kWh));
    $("#NMvoc_value").text(parseFloatAccordingToLocale(stats['NMvoc'] / 1000 / total_kWh));
    $("#Particles_value").text(parseFloatAccordingToLocale(stats['Particles'] / 1000 / total_kWh));

    $("#CoalFlyAsh_value").text(parseFloatAccordingToLocale(stats['CoalFlyAsh'] / total_kWh));
    $("#CoalSlag_value").text(parseFloatAccordingToLocale(stats['CoalSlag'] / total_kWh));
    $("#Desulp_value").text(parseFloatAccordingToLocale(stats['Desulp'] / total_kWh));
    $("#WasteSlag_value").text(parseFloatAccordingToLocale(stats['WasteSlag'] / total_kWh));
    $("#FuelGasWaste_value").text(parseFloatAccordingToLocale(stats['FuelGasWaste'] / total_kWh));
    $("#Bioash_value").text(parseFloatAccordingToLocale(stats['Bioash'] / total_kWh));
    $("#RadioactiveWaste_value").text(parseFloatAccordingToLocale(stats['RadioactiveWaste'] / total_kWh));
}

function initFuelStats() {
    let stats = {
        Total_kWh: 0
    };

    for (var fuelType of FUEL_TYPES) {
        stats[fuelType] = {}
        for (var connectedArea of CONNECTED_AREAS) {
            stats[fuelType][connectedArea] = 0
        }
    }

    return stats;
}

function initEmissionStats() {
    let stats = {}

    for (var emissionType of EMISSION_TYPES) {
        stats[emissionType] = 0
    }

    return stats;
}

function parseFloatAccordingToLocale(number, numDecimals = 2) {
    return parseFloat(number.toFixed(numDecimals)).toLocaleString('da-DK', {minimumFractionDigits: numDecimals})
}

function findAreaFromID(id, array) {
    for (var item of array) {
        if (id === item['id'])  {
            return item['area'];
        }
    }
    return undefined;
}

function processMeasuringPoints(measuringPoints, fuelStats, emissionStats, dataAccessToken) {
    $('#label-emission-data').text('Beregner miljødeklarationen...');
    measuringPointsIDAndArea = getAllMeasuringPointsIDAndArea(measuringPoints);

    let dfd = $.Deferred();
    var promise = dfd.promise()

    for (var i=0; i<measuringPointsIDAndArea.length; i+=CHUNK_SIZE) {
        let slice = measuringPointsIDAndArea.slice(i,i+CHUNK_SIZE);

        promise = promise.then(function() {
            return retrieveTimeSeries(slice, dataAccessToken)
        }).then(function(data) {
            console.log(data)

            let result = data['result']
            for (var j = 0; j < result.length; j++) {
                let period = result[j]['MyEnergyData_MarketDocument']['TimeSeries'][0]['Period'];
                let id =  result[j]['id'];

                let kWh_hourly = processTimeSeries(period);

                let area = findAreaFromID(id, slice);
                calculateFuelStats(kWh_hourly, fuelStats, area);
                calculateEmissionStats(kWh_hourly, emissionStats, area);
            }
        });
    }

    dfd.resolve()

    return promise
}

function clear_data() {
    $('#data-sector').attr('hidden', true);
    $('#label-master-data').text('');
    $('#label-emission-data').text('');
}

function computeDeclaration(obj) {
    clear_data()

    let refreshToken = $('#input-token').val();

    $('#label-status').text('Fremstiller miljødeklarationen. Vent venligst...');

    retrieveDataAccessToken(refreshToken).then(function(data) {
        let dataAccessToken = data['result'];

        retrieveMeasuringPoints(dataAccessToken).then(function(data) {
            let measuringPoints = data['result'];

            $('#label-master-data').text('Forbrugsstamdata');

            buildMasterDataTable(measuringPoints);

            let fuelStats = initFuelStats();
            let emissionStats = initEmissionStats();
            processMeasuringPoints(measuringPoints, fuelStats, emissionStats, dataAccessToken).then(function() {
                $('#label-status').text('');

                console.log('HELLLLOOOOOOO')
                console.log('fuelStats = ' + fuelStats);
                console.log('emissionStats = ' + emissionStats);

                buildEmissionTable(emissionStats, fuelStats['Total_kWh']);
                buildBarChart(fuelStats);
                buildGaugeChart(fuelStats);
                buildTechnologyTable(fuelStats);
                buildConnectedAreaTable(fuelStats)

                $('#co2Total').text(parseFloatAccordingToLocale((emissionStats['CO2'] / 1000)) + ' kg');
                $('#co2Relative').text(parseFloatAccordingToLocale((emissionStats['CO2'] / fuelStats['Total_kWh'])) + ' g/kWh');

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

    for (var technology in fuelStats) {
        if (technology !== 'Total_kWh') {
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
    $('#gaugeArea').empty();

    let greenPercentage = greenEnergyPercentage(fuelStats)

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

    for (var technology of FUEL_TYPES) {
        if (technology !== 'Total_kWh') {
            let consumed = sumConnectedAreas(fuelStats[technology]);
            table.append(`<tr>
                             <td style="background-color:${COLORS[technology]};"><img src="${IMAGES[technology]}" width="30" height="30"></td>
                             <td>${technology}</td>
                             <td class="text-end">${formatAmount(consumed, fuelStats['Total_kWh'])}</td>
                             <td class="text-end">${getProcentwiseOfTotal(consumed, fuelStats['Total_kWh'])}%</td>
                         </tr>`);
        }
    }

    table.append(`<tr><td></td><td class='h4'>Total forbrug</td><td class='h4'>${formatAmount(fuelStats['Total_kWh'], fuelStats['Total_kWh'])}</td><td></td></tr>`)
}

function sumFuelsAccordingToConnectedArea(fuelStats, connectedArea) {
    var sum = 0
    for (var technology of FUEL_TYPES) {
        sum += fuelStats[technology][connectedArea];
    }

    return sum;
}

function buildConnectedAreaTable(fuelStats) {
    var table = $('#connectedAreaTable');
    table.empty();

    for (var technology of FUEL_TYPES) {
        if (technology !== 'Total_kWh') {
            let consumed = sumConnectedAreas(fuelStats[technology]);

            var rows = ``
            for (var connectedArea of CONNECTED_AREAS) {
                rows += `<td class="text-end">${getProcentwiseOfTotal(fuelStats[technology][connectedArea], fuelStats['Total_kWh'])}%</td>`
            }

            table.append(`<tr>
                          <td class="text-center" style="background-color:${COLORS[technology]};"><img src="${IMAGES[technology]}" width="30" height="30"></td>
                          <td>${technology}</td>
                          ${rows}
                          <td class="text-end"><strong>${getProcentwiseOfTotal(consumed, fuelStats['Total_kWh'])}%</strong></td>
                          </tr>`);
        }
    }

    var rows = ``
    for (var connectedArea of CONNECTED_AREAS) {
        rows += `<td class="text-end"><strong>${getProcentwiseOfTotal(sumFuelsAccordingToConnectedArea(fuelStats, connectedArea), fuelStats['Total_kWh'])}%</strong></td>`
    }
    table.append(`<tr>
                  <td></td>
                  <td><strong>Total</strong></td>
                  ${rows}
                  <td class="text-end"><strong>100.00%</strong></td>
                  </tr>`)
}


function formatAmount(amountkWh, totalAmountKwH) {
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


function greenEnergyPercentage(fuelStats) {
    let total = fuelStats['Total_kWh'];
    let greenEnergy = sumConnectedAreas(fuelStats['Sol'])
                    + sumConnectedAreas(fuelStats['Vind'])
                    + sumConnectedAreas(fuelStats['Vandkraft'])

    return Math.round(greenEnergy / total * 100);
}
