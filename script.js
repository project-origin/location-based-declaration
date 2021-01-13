let EMISSION_DATA;
let FUEL_DATA;
let REFERENCES;

let API_HOST = 'https://api.eloverblik.dk';
let LOADER_GIF_URL = 'https://energinet.dk/resources/images/bx_loader.gif';
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
];

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
    // Sets up button click on Enter keypress
    $("#input-token").keypress(function(event) {
        if (event.keyCode === 13) { // Keypress on Enter
            $("#button-calculate").click();
        }
    });
});

/**
 * Loads emission data for the given year.
 * @param year The year to load data for.
 */
function loadEmissionData(year) {
    $.ajax({
        type: "GET",
        url: `./data/${year}_emission_data.json`,
        dataType: "json"
    }).done(function(data) {
        EMISSION_DATA = data;
    });
}

/**
 * Loads fuel data for the given year.
 * @param year The year to load data for.
 */
function loadFuelData(year) {
    $.ajax({
        type: "GET",
        url: `./data/${year}_fuel_data.json`,
        dataType: "json"
    }).done(function(data) {
        FUEL_DATA = data;
    });
}

/**
 * Loads reference data for the given year.
 * @param year The year to load data for.
 */
function loadReferences(year) {
    $.ajax({
        type: "GET",
        url: `./data/${year}_references.json`,
        dataType: "json",
    }).done(function(data) {
        REFERENCES = data;
    });
}

/**
* Returns a list of tuples containing the ID and price area for all measuring points.
* @param measuringPoints List of measuring point objects retrieved from eloverblik.dk.
* @return List of tuples containing the ID and price area for all measuring points.
*/
function getAllMeasuringPointsIDAndArea(measuringPoints) {
    let ids = [];

    for (var measuringPoint of measuringPoints) {
        if (measuringPoint.typeOfMP !== 'E17' || measuringPoint.settlementMethod === 'E01')
            continue;

        // the postcode decides which price area the measuring point belongs to.
        let area = parseInt(measuringPoint.postcode) >= 5000 ? 'DK1' : 'DK2';

        ids.push({id: measuringPoint.meteringPointId, area: area});
    }

    return ids;
}

/**
* Extracts the consumption for every hour and flattens it out in a ordered list with the first element being
* the consumption for the earlist datetime and the last element being the consumption for the last datetime.
* @params period List of days.hours.consumption as retrieved from eloverblik.dk.
* @return List of comsumption.
*/
function extractHours(period) {
    let kWhHourly = [];

    for (var elem of period) {
        for (var point of elem.Point) {
            kWhHourly.push(parseFloat(point['out_Quantity.quantity']));
        }
    }

    return kWhHourly;
}

/**
Merges the data from eloverblik.dk with the actual emission for every hour and sums it into the different emission types.
* @param kWhHourly List of consumption for every hour.
* @param stats The stats object containing the total emission for every type.
* @param offsetStartFrom The offset to start the merge from. Not every consumption starts at year beginning or ends at year end.
*/
function calculateEmissionStats(kWhHourly, stats, area, offsetStartFrom) {
    let areaEmissionData = EMISSION_DATA[area];

    for (var emissionType of Object.keys(EMISSION_TYPES)) {
        if (emissionType === 'CO2Eqv') // this value is computed so we skip it.
            continue;

        for (var i = 0; i < kWhHourly.length && i + offsetStartFrom < areaEmissionData[emissionType].length; i++) {
            stats[emissionType] += areaEmissionData[emissionType][i + offsetStartFrom].P * kWhHourly[i];
        }
    }
}

/**
Merges the data from eloverblik.dk with the actual fuel for every hour and sums it into the different fuel types.
* @param kWhHourly List of consumption for every hour.
* @param stats The stats object containing the total energy for every fuel type.
* @param offsetStartFrom The offset to start the merge from. Not every consumption starts at year beginning or ends at year end.
*/
function calculateFuelStats(kWhHourly, stats, area, offsetStartFrom) {
    let areaFuelData = FUEL_DATA[area];

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        for (var connectedArea of CONNECTED_AREAS) {

            for (var i = 0; i < kWhHourly.length && i + offsetStartFrom < areaFuelData[fuelType][connectedArea].length; i++) {
                let kWh = areaFuelData[fuelType][connectedArea][i + offsetStartFrom].S * kWhHourly[i];

                stats.Total_kWh += kWh;
                stats[area] += kWh;
                stats[fuelType][connectedArea] += kWh;
            }
        }
    }
}

/**
* Retrieves timeseries for the given list of measuring points from eloverblik.dk for the given year.
* @param ids List of ids for the measuring points.
* @param year The year to retrieve data for.
* @param dataAccessToken The data access token.
* @return The timeseries object for the given measuring points.
*/
function retrieveTimeSeries(ids, year, dataAccessToken) {
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

/**
* Retrieves measuring points which belongs to the given data access token.
* @param dataAccessToken The data access token.
* @return List of measuring points.
*/
function retrieveMeasuringPoints(dataAccessToken) {
    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/meteringpoints/meteringpoints?includeAll=false`,
        type: 'GET',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + dataAccessToken);
        }
    });
}

/**
* Retrieves the session token.
* @param dataAccessToken The refresh token.
* @return The data access token.
*/
function retrieveDataAccessToken(refreshToken) {
    return $.ajax({
        url: `${API_HOST}/CustomerApi/api/Token`,
        type: 'GET',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + refreshToken);
        }
    });
}

/**
* Initializes the stats object for fuel.
* @return The fuel stats object.
*/
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

/**
* Initializes the stats object for emission.
* @return The emission stats object.
*/
function initEmissionStats() {
    let stats = {};

    for (var emissionType of Object.keys(EMISSION_TYPES)) {
        stats[emissionType] = 0;
    }

    return stats;
}

/**
* Finds the price area for the given ID in the given list of tuples (id, area).
* @param id The id.
* @param measuringPointsIDAndArea a list of (id, area).
* @return The price area which corresponds to the given ID.
*/
function findAreaFromID(id, measuringPointsIDAndArea) {
    for (var item of measuringPointsIDAndArea) {
        if (id === item.id) {
            return item.area;
        }
    }

    throw 'ID not in the given list';
}

/**
* Finds the offset to merge the hourly consumption from eloverblik.dk with the emission and fuel data.
* It should be remarked that the hourly consumption data fra eloverblik.dk doesnt always starts at year start
* or ends at year ends.
* @param period The period retrieved from eloverblik.dk.
* @return The offset to start merging from.
*/
function findOffsetStartFrom(period) {
    if (period.length === 0)
        throw 'Period contained no values';

    let start = period[0].timeInterval.start;
    let compressedStart = start.substring(2, start.length - 7).replaceAll('-', '').replaceAll('T', '');

    // Every fuel type and emission type contains hourly data for the whole year so we just pick Vind in Dk1.
    for (var i = 0; i < FUEL_DATA.DK1.Vind.DK1.length; i++) {
        if (compressedStart === FUEL_DATA.DK1.Vind.DK1[i].T)
            return i;
    }

    throw 'Timeslot was not found';
}

/**
* Processes a single timeseries.
* @param timeseries The timeseries as retrieved from eloverblik.dk.
* @param id The ID for the measuring points.
* @param measuringPointsIDAndArea List of (id, area) for the measuringPoints.
* @param fuelStats The stats object containing the total emission for every emission type.
* @param emissionStats The stats object containing the total energy for every fuel type.
*/
function processTimesSeries(timeseries, id, measuringPointsIDAndArea, fuelStats, emissionStats) {
    if (timeseries.length == 0 || timeseries[0].businessType !== 'A04') {
        $(`.${id}-status`).text('Ikke time opgjort');
        return;
    }

    let period = timeseries[0].Period;
    let offsetStartFrom = findOffsetStartFrom(period);
    let kWhHourly = extractHours(period);
    let area = findAreaFromID(id, measuringPointsIDAndArea);

    calculateFuelStats(kWhHourly, fuelStats, area, offsetStartFrom);
    calculateEmissionStats(kWhHourly, emissionStats, area, offsetStartFrom);

    $(`.${id}-status`).text('Inkluderet');
}

/**
* Processes all the given measuring points.
* @param measuringPoints List of measuring points.
* @param year The year to base the consumption on.
* @dataAccessToken The data access token.
*/
function processMeasuringPoints(measuringPoints, year, dataAccessToken) {
    $('#label-status').html(`Fremstiller din deklarationen. Vent venligst <img src="${LOADER_GIF_URL}" width="25" height="25">`);
    measuringPointsIDAndArea = getAllMeasuringPointsIDAndArea(measuringPoints);

    var downloaded = 0;
    $('#download-status').text(`Hentet ${downloaded}/${measuringPointsIDAndArea.length} målere.`);

    let fuelStats = initFuelStats();
    let emissionStats = initEmissionStats();
    let apiCallList = [];

    for (var i = 0; i < measuringPointsIDAndArea.length; i += CHUNK_SIZE) {

        let ids = measuringPointsIDAndArea.slice(i, i + CHUNK_SIZE).map(function(A) {
            return A.id;
        });

        apiCallList.push(retrieveTimeSeries(ids, year, dataAccessToken).then(function(data) {
            let result = data.result;
            for (var j = 0; j < result.length; j++) {
                let timeseries = result[j].MyEnergyData_MarketDocument.TimeSeries;
                let id = result[j].id;

                processTimesSeries(timeseries, id, measuringPointsIDAndArea, fuelStats, emissionStats);
            }

            downloaded += ids.length;
            $('#download-status').text(`Hentet ${downloaded}/${measuringPointsIDAndArea.length} målere.`);
        }));
    }

    // Initiate all the ajax requests at the same time and wait until they all return and is processed.
    Promise.all(apiCallList).then(function() {
        if (fuelStats.Total_kWh === 0) {
            $('#label-status').text('Der er ikke registreret timeforbrug på dine målere.');
        } else {
            buildEmissionFuelPage(fuelStats, emissionStats);
        }

        $("#button-calculate").removeAttr("disabled");

    }).catch(function(error) {
        $('#label-status').text('Noget gik galt. Kunne ikke beregne miljødeklarationen. Prøv igen eller kontakt administratoren.');
        console.log(error);
        $("#button-calculate").removeAttr("disabled");
    });
}

/**
* Loads the emission, fuel and reference data for the given year.
* @param year The year.
* @return The promise containing the ajax calls.
*/
function loadData(year) {
    return Promise.all([loadEmissionData(year), loadFuelData(year), loadReferences(year)]);
}

/**
* The starting function for computing the declaration.
*/
function computeDeclaration() {
    hideSections();
    $("#button-calculate").attr("disabled", "disabled");
    let year = parseInt($("#input-year").val());

    $('#title-year').text(year);

    let refreshToken = $('#input-token').val();

    $('#label-status').html(`Fremsøger din stamdata. Vent venligst <img src="${LOADER_GIF_URL}" width="20" height="20">`);

    loadData(year).then(function() {
        retrieveDataAccessToken(refreshToken).then(function(data) {
            let dataAccessToken = data.result;

            retrieveMeasuringPoints(dataAccessToken).then(function(data) {
                let measuringPoints = data.result;

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

/****************************** HTML build functions ******************************/

/**
* Returns a formatted string representation of address.
* @param measuringPoint the measuring point object.
* @return String representation of address.
*/
function formatAddress(measuringPoint) {
    var address = measuringPoint.streetName;

    if (measuringPoint.buildingNumber)
        address += " " + measuringPoint.buildingNumber;
    if (measuringPoint.floorId)
        address += ", " + measuringPoint.floorId;
    if (measuringPoint.roomId && measuringPoint.floorId)
        address += " " + measuringPoint.roomId;
    else if (measuringPoint.roomId)
        address += ", " + measuringPoint.roomId;

    return address;
}

/**
* Builds the table containing cvr(s) and name(s) of the user.
* @param cvrs List of strings containing cvr and name separated by *.
*/
function buildConsumerTable(cvrs) {
    let cvrTable = $('#table-cvr-data');
    cvrTable.empty('*');

    for (var cvr of cvrs.values()) {
        let elements = cvr.split('*');
        cvrTable.append(`<tr><td class="h4">${elements[0]}</td><td class="h4">${elements[1]}</td></tr>`);
    }
}

/**
* Builds the table containing ID and address of all the measuring points.
* @param mps List of strings containing information about measuring points separated by *.
*/
function buildMeteringPointTable(mps) {
    let mpTable = $('.table-mp-data');
    mpTable.empty();

    for (var mp of mps.values()) {
        let elements = mp.split('*');

        mpTable.append(`<tr><td>${elements[0]}</td><td>${elements[1]}</td><td>${elements[2]}</td><td>${elements[3]}</td><td class="${elements[0]}-status">${elements[4]}</td></tr>`);
    }
}

/**
* Builds the tables containing master data.
* @param data List of information about the measuring points.
*/
function buildMasterDataTables(data) {
    let cvrs = new Set();
    let mps = new Set();

    for (var elem of data) {
        cvrs.add(elem.consumerCVR + '*' + elem.firstConsumerPartyName);

        let type = (elem.typeOfMP !== 'E17' || elem.settlementMethod === 'E01') ?
            'Ekskluderet (Produktion)' : `Henter data <img src="${LOADER_GIF_URL}" width="20" height="20">`;

        mps.add(elem.meteringPointId + '*' +
            formatAddress(elem) + '*' +
            elem.postcode + '*' +
            elem.cityName + '*' +
            type);
    }

    buildConsumerTable(cvrs);
    buildMeteringPointTable(mps);

    $('.master-data-sector').removeAttr('hidden');
}

/**
* Builds the table containing emission data.
* @param stats The stats object containing the total emission for every emission type.
* @param totalkWh The total kWh consumption.
* @param DK1kWh The kWh consumption in DK1.
* @param DK2kWh The kWh consumption in DK2.
*/
function buildEmissionTable(stats, totalkWh, DK1kWh, DK2kWh) {
    let table = $('#table-emissions');
    table.empty();

    let dk1Part = DK1kWh / totalkWh;
    let dk2Part = DK2kWh / totalkWh;

    var airRows = '';
    var residualRows = '';

    for (var emissionType of Object.keys(EMISSION_TYPES)) {
        let value = getEmissionValue(emissionType, stats);
        let ref_value = parseFloatAccordingToLocale(dk1Part * REFERENCES.emission[emissionType].ref_dk1 +
            dk2Part * REFERENCES.emission[emissionType].ref_dk2, (emissionType === 'N2O') ? 3 : 2);

        var html = '';
        if (emissionType === 'CO2Eqv') {
            html = `<tr>
              <td class="text-start"><em>${EMISSION_TYPES[emissionType].html}</em></td>
              <td class="text-center"><em>${parseFloatAccordingToLocale(value / totalkWh, EMISSION_TYPES[emissionType].numDecimals)}</em></td>
              <td class="text-end text-secondary"><em>${ref_value}</em></td>
              </tr>`;
        } else {
            html = `<tr>
            <td class="text-start">${EMISSION_TYPES[emissionType].html}</td>
            <td class="text-center">${parseFloatAccordingToLocale(value / totalkWh, EMISSION_TYPES[emissionType].numDecimals)}</td>
             <td class="text-end text-secondary">${ref_value}</td>
            </tr>`;
        }

        if (EMISSION_TYPES[emissionType].type === 'air') {
            airRows += html;
        } else if (EMISSION_TYPES[emissionType].type === 'residual') {
            residualRows += html;
        } else {
            throw 'Unknown type. Must be air or residual';
        }
    }

    table.append('<tr><td class="text-start"><strong>Emissioner til luften</strong></td><td  class="text-center" colspan="2"><strong>g/kWh</strong></td></tr>');
    table.append(airRows);
    table.append('<tr><td class="text-start"><strong>Restprodukter</strong></td><td  class="text-center" colspan="2"><strong>g/kWh</strong></td></tr>');
    table.append(residualRows);
}

/**
* Hides master and emission data sections in the HTML page.
*/
function hideSections() {
    $('.master-data-sector').attr('hidden', true);
    $('.emission-data-sector').attr('hidden', true);
}

/**
* Formats the amount depending on number of digits and attaches the correct unit.
* @param amount The amount to be formatted.
* @return Formatted amount concatenated with the unit.
*/
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

/**
* Builds the HTML section containing the fuel and emission data.
* @param fuelStats The stats object containing the total energy for every fuel type.
* @param emissionStats The stats object containing the total emission for every emission type.
*/
function buildEmissionFuelPage(fuelStats, emissionStats) {
    $('#label-status').text('');

    buildEmissionTable(emissionStats, fuelStats.Total_kWh, fuelStats.DK1, fuelStats.DK2);
    buildBarChart(fuelStats);
    buildGaugeChart(fuelStats);
    buildIndicatorGaugeChart(emissionStats, fuelStats);
    buildFuelTable(fuelStats);
    buildConnectedAreaTable(fuelStats);

    $('#num-co2-total').text(formatPolutionAmount(emissionStats.CO2));
    $('#num-co2-relative').text(parseFloatAccordingToLocale((emissionStats.CO2 / fuelStats.Total_kWh)) + ' g/kWh');

    $('.emission-data-sector').removeAttr('hidden');
}

/**
* Builds a pie chart for fuel types.
* @param fuelStats The stats object containing the total energy for every fuel type.
*/
function buildBarChart(fuelStats) {
    var ctx = document.getElementById('barChart').getContext('2d');
    var labels = [];
    var values = [];
    var colors = [];

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        if (fuelType !== 'Total_kWh') {
            labels.push(fuelType);
            values.push(sumConnectedAreas(fuelStats[fuelType]));
            colors.push(FUEL_TYPES[fuelType].color);
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
                            formatEnergyAmount(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index], fuelStats.Total_kWh);
                    }
                }
            }
        }
    });
}

/**
* Builds a gauge which shows how much of the energy consumption comes from sustainable energy.
* @param fuelStats The stats object containing the total energy for every fuel type.
*/
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

/**
* Builds a gauge which shows how much CO2 is derived compared to the reference.
* @param fuelStats The stats object containing the total energy for every fuel type.
* @param emissionStats The stats object containing the total emission for every emission type.
*/
function buildIndicatorGaugeChart(emissionStats, fuelStats) {
    let element = document.querySelector('#gauge-indicator-meter');
    $('#gauge-indicator-meter').empty();

    let totalkWh = fuelStats.Total_kWh;
    let dk1Part = fuelStats.DK1 / totalkWh;
    let dk2Part = fuelStats.DK2 / totalkWh;

    let CO2 = emissionStats.CO2 / totalkWh;

    let reference = dk1Part * REFERENCES.emission.CO2.ref_dk1 + dk2Part * REFERENCES.emission.CO2.ref_dk2;

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
    let needleValue = (multiplied > 50) ? 100 : (multiplied < -50) ? -50 : multiplied;

    GaugeChart.gaugeChart(element, 300, gaugeOptions).updateNeedle(50 + needleValue);
}

/**
* Builds the table containing fuel data.
* @param fuelStats The stats object containing the total energy for every fuel type.
*/
function buildFuelTable(fuelStats) {
    let table = $('#table-fuels');
    table.empty();

    let totalkWh = fuelStats.Total_kWh;
    let dk1Part = fuelStats.DK1 / totalkWh;
    let dk2Part = fuelStats.DK2 / totalkWh;

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        if (fuelType !== 'Total_kWh') {
            let consumed = sumConnectedAreas(fuelStats[fuelType]);
            let ref_value = dk1Part * REFERENCES.fuel[fuelType].ref_dk1 + dk2Part * REFERENCES.fuel[fuelType].ref_dk2;
            table.append(`<tr>
                    <td style="background-color:${FUEL_TYPES[fuelType].color};"><img src="${FUEL_TYPES[fuelType].image}" width="30" height="30"></td>
                    <td>${fuelType}</td>
                    <td class="text-end">${formatEnergyAmount(consumed, totalkWh)}</td>
                    <td class="text-end">${getProcentwiseOfTotal(consumed, totalkWh)}%</td>
                    <td class="text-end text-secondary">${parseFloatAccordingToLocale(ref_value, 2)}%</td>
                    </tr>`);
        }
    }

    table.append(`<tr><td></td><td class='h4' colspan="2">Total forbrug</td><td class='h4' colspan="2">${formatEnergyAmount(totalkWh, totalkWh)}</td></tr>`);
}

/**
* Builds the table containing which country/area the energy is from.
* @param fuelStats The stats object containing the total energy for every fuel type.
*/
function buildConnectedAreaTable(fuelStats) {
    let table = $('#table-from-production');
    table.empty();

    let totalkWh = fuelStats.Total_kWh;

    for (var fuelType of Object.keys(FUEL_TYPES)) {
        if (fuelType !== 'Total_kWh') {
            let consumed = sumConnectedAreas(fuelStats[fuelType]);

            var rows = ``;
            for (var connectedArea of CONNECTED_AREAS) {
                rows += `<td class="text-end">${getProcentwiseOfTotal(fuelStats[fuelType][connectedArea], totalkWh)}%</td>`;
            }

            table.append(`<tr>
                    <td class="text-center" style="background-color:${FUEL_TYPES[fuelType].color};"><img src="${FUEL_TYPES[fuelType].image}" width="30" height="30"></td>
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

/**
* Sums the energy consumption across connected areas.
* @param consumedFromConnectedArea Object with energy consumption per connected areas.
* @return The sum.
*/
function sumConnectedAreas(consumedFromConnectedArea) {
    var sum = 0;
    for (var connectedArea of CONNECTED_AREAS) {
        sum += consumedFromConnectedArea[connectedArea];
    }

    return sum;
}

/**
* Returns the procentwise of amount out of the total amount.
* @param amount The amount.
* @param totalAmount The total amount.
* @return Procentwise of amount out of the total amount.
*/
function getProcentwiseOfTotal(amount, totalAmount) {
    return parseFloatAccordingToLocale((amount * 100) / totalAmount);
}

/**
* Sums the energy consumption according to the given connected area.
* @param fuelStats The stats object containing the total energy for every fuel type.
* @param connectedArea The connected area.
* @return The sum.
*/
function sumFuelsAccordingToConnectedArea(fuelStats, connectedArea) {
    var sum = 0;
    for (var fuelType of Object.keys(FUEL_TYPES)) {
        sum += fuelStats[fuelType][connectedArea];
    }

    return sum;
}

/**
* Formats the amount depending on number of digits for the total consumption and attaches the correct unit.
* @param amountkWh The amount to be formatted.
* @param totalAmountkWh The total amount.
* @return Formatted amount concatenated with the unit.
*/
function formatEnergyAmount(amountkWh, totalAmountkWh) {
    let unit;
    let actualAmount;

    if (totalAmountkWh >= Math.pow(10, NUM_DIGITS_MEGA_CONVERT)) {
        unit = 'MWh';
        actualAmount = (amountkWh / Math.pow(10, 3));
    } else {
        unit = 'kWh';
        actualAmount = amountkWh;
    }

    return parseFloatAccordingToLocale(actualAmount, 0) + ' ' + unit;
}

/**
* Calculate how much of the energy comes from sustainable energy.
* @param fuelStats The stats object containing the total energy for every fuel type.
* @return Procentwise which is from sustainable energy.
*/
function sustainableEnergyPercentage(fuelStats) {
    let total = fuelStats.Total_kWh;
    let greenEnergy = sumConnectedAreas(fuelStats.Sol) +
        sumConnectedAreas(fuelStats.Vind) +
        sumConnectedAreas(fuelStats.Vandkraft) +
        sumConnectedAreas(fuelStats.Biomasse) +
        sumConnectedAreas(fuelStats.Affald) * 0.55;

    return Math.round(greenEnergy / total * 100);
}

/**
* Ensures that the number is parsed according to localization with correct use of separators.
* @param number The number to be parsed.
* @param numDecimals Number of decimals.
* @return The parsed number as a localized string.
*/
function parseFloatAccordingToLocale(number, numDecimals = 2) {
    return parseFloat(number.toFixed(numDecimals)).toLocaleString('da-DK', {
        minimumFractionDigits: numDecimals
    });
}

/**
* Returns the value for the emission type.
* @param emissionType The emission type.
* @param stats The stats object containing the total emission for every emission type.
*/
function getEmissionValue(emissionType, stats) {
    if (emissionType === 'CO2Eqv') {
        return stats.CO2 + (stats.CH4 * 28) / 1000 + (stats.N2O * 265) / 1000;
    }

    if (EMISSION_TYPES[emissionType].unit === 'g') {
        return stats[emissionType];
    } else if (EMISSION_TYPES[emissionType].unit === 'mg') {
        return stats[emissionType] / 1000;
    } else {
        throw 'Unknown unit type';
    }
}
