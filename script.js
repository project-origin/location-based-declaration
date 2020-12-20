let EMISSION_TYPES;
let FUEL_TYPES;
let EMISSION_DATA;
let FUEL_DATA;

let API_HOST = 'https://api.eloverblik.dk';
let YEAR = '2019';

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
        FUEL_TYPES = data['fuel_types']
        EMISSION_DATA = data['emission_data']
        FUEL_DATA = data['fuel_data']
    });
}

function getAllMeasuringPointsIDAndArea(measuringPoints) {
    ids = []

    for (measuringPoint of measuringPoints) {
        console.log(measuringPoint)
        if (measuringPoint['typeOfMP'] !== 'E17')
            continue

        area = parseInt(measuringPoint['postcode']) < 5000 ? 'DK' : 'DK';
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

    for (emission_type of EMISSION_TYPES) {
        for (var i = 0; i < kWh_hourly.length; i++) {
            stats[emission_type] += area_emission_data[emission_type][i]['PerkWh'] * kWh_hourly[i]

            stats['Total_kWh'] += kWh_hourly[i]
        }
    }
}

function calculateFuelStats(kWh_hourly, stats) {
    area_fuel_data = FUEL_DATA[area]

    for (var i = 0; i < kWh_hourly.length; i++) {
        for (fuel_type of FUEL_TYPES) {
            kWh = area_fuel_data[fuel_type][i]['ProcentwiseGross'] * kWh_hourly[i]

            stats['Total_kWh'] += kWh
            stats[fuel_type] += kWh
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

function generateMasterDataTable(data) {
    for (let elem of data) {
        row = $("#table-master-data tbody")[0].insertRow();

        for (value of [elem['meteringPointId'], formatAddress(elem), elem['postcode'], elem['cityName']]) {
            let cell = row.insertCell();
            let text = document.createTextNode(value);
            cell.appendChild(text);
        }
    }

    $("#table-master-data").removeAttr('hidden');
}

function convertToPerkWh(emission_value, total_kWh, num_decimals) {
    return (emission_value / total_kWh).toFixed(num_decimals)
}

function generateEmissionTable(stats) {
    total_kWh = stats['Total_kWh']

    $("#Co2_value").text(convertToPerkWh(stats['Co2'], total_kWh, 2));

    $("#table-emission-data").removeAttr('hidden');
}

function initFuelStats() {
    stats = {
        Total_kWh: 0
    };

    for (type of FUEL_TYPES) {
        stats[type] = 0
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

            calculateFuelStats(kWh_hourly, fuelStats)
            calculateEmissionStats(kWh_hourly, emissionStats)
        });
    }

    dfd.resolve()

    return promise
}

function clear_data() {
    $("#table-master-data").attr("hidden", true);
    $("#table-emission-data").attr("hidden", true);
    $("#table-master-data tbody tr").empty();
    $('#label-master-data').text('');
    $('#label-emission-data').text('');
}

function computeDeclaration(obj) {
    clear_data()

    let refreshToken = $('#input-token').val();

    $('#label-master-data').text('Fremsøger forbrugsstamdata...');

    retrieveDataAccessToken(refreshToken).then(function(data) {
        dataAccessToken = data['result'];

        retrieveMeasuringPoints(dataAccessToken).then(function(data) {
            measuringPoints = data['result'];

            $('#label-master-data').text('Forbrugsstamdata');

            generateMasterDataTable(measuringPoints);

            fuelStats = initFuelStats();
            emissionStats = initEmissionStats();
            processMeasuringPoints(measuringPoints, fuelStats, emissionStats).then(function() {
                $('#label-emission-data').text('Miljøforhold for el leveret til forbrug');

                generateEmissionTable(emissionStats)

                console.log(fuelStats)
                console.log(emissionStats)
            }).catch(function() {
                $('#label-emission-data').text('Noget gik galt. Kunne ikke beregne miljødeklarationen. Prøv igen eller kontakt administratoren.');
            });

        }).catch(function() {
            $('#label-emission-data').text('Noget gik galt. Kunne ikke hente forbrugsdata. Prøv igen eller kontakt administratoren.');
        });
    }).catch(function() {
        $('#label-master-data').text('Noget gik galt. Venligst sikrer dig at din token er valid.');
    });
}
