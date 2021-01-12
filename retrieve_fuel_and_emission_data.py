import csv
import json
import requests
import argparse
from requests.utils import requote_uri

VALID_AREAS = ['DK1', 'DK2']
CONNECTED_AREAS = ['NO', 'NL', 'GE', 'SE', 'DK2', 'DK1']

GROUP_FUELS = {
    "Offshore": "Vind",
    "Onshore": "Vind",
    "Solceller": "Sol",
    "Sol": "Sol",
    "Anden VE": "Vandkraft",
    "Vandkraft": "Vandkraft",
    "Biogas": "Biomasse",
    "Træ_mm": "Biomasse",
    "Halm": "Biomasse",
    "Affald": "Affald",
    "Naturgas": "Naturgas",
    "Brunkul": "Kul og Olie",
    "Kul": "Kul og Olie",
    "Fuelolie": "Kul og Olie",
    "Gasolie": "Kul og Olie",
    "Olie": "Kul og Olie",
    "Atomkraft": "Atomkraft"
}

FUEL_TYPES = list(set(GROUP_FUELS.values()))


def retrieve_fuel_data(year):
    url = f'https://www.energidataservice.dk/proxy/api/datastore_search_sql?sql=\
          SELECT "HourUTC", "PriceArea", "ConnectedArea", "ProductionGroup", "Share" \
          FROM "declarationcoveragehour" \
          WHERE "HourDK" >= \'{year}-01-01\' AND "HourDK" < \'{year + 1}-01-01\' \
          ORDER BY "HourUTC" ASC'

    response = requests.get(requote_uri(url))
    records = response.json()['result']['records']

    for record in records:
        record['ProductionGroup'] = GROUP_FUELS[record['ProductionGroup']]
        record['PriceArea'] = record['PriceArea'].upper()

    return records


def retrieve_emission_data(year):
    url = f'https://www.energidataservice.dk/proxy/api/datastore_search_sql?sql=\
           SELECT "HourUTC", "PriceArea", "CO2PerkWh", "SO2PerkWh", "NOxPerkWh", "NMvocPerkWh", \
           "CH4PerkWh", "COPerkWh", "N2OPerkWh", "ParticlesPerkWh", "CoalFlyAshPerkWh", "CoalSlagPerkWh", \
           "DesulpPerkWh", "FuelGasWastePerkWh", "BioashPerkWh", "WasteSlagPerkWh", "RadioactiveWastePerkWh" \
           FROM "declarationemissionhour" \
           WHERE "HourDK" >= \'{year}-01-01\' AND "HourDK" < \'{year + 1}-01-01\' \
           ORDER BY "HourUTC" ASC'

    response = requests.get(requote_uri(url))
    records = response.json()['result']['records']

    return records


def calculate_kwh_per_hour(fuel_data):
    kwh_hourly = {}
    fuel_types = set()

    for row in fuel_data:
        hour = row['HourUTC']
        area = row['PriceArea']
        consumed = row['ConsumedDK'] * 1000 # convert from MWh to kWh.

        kwh_hourly[(hour, area)] = kwh_hourly.get((hour, area), 0) + consumed

        fuel_types.add(row['DKFuelType'])

    return list(fuel_types), kwh_hourly


def convert_to_intermediate_data(fuel_data):
    filled_fuel_data = {}

    for area in VALID_AREAS:
        filled_fuel_data[area] = {}

    for row in fuel_data:
        hour = row['HourUTC']
        area = row['PriceArea']

        if not hour in filled_fuel_data[area]:
            filled_fuel_data[area][hour] = {}

            for fuel_type in FUEL_TYPES:
                filled_fuel_data[area][hour][fuel_type] = {}

                for connectedArea in CONNECTED_AREAS:
                    filled_fuel_data[area][hour][fuel_type][connectedArea] = 0

        filled_fuel_data[area][hour][row['ProductionGroup']][row['ConnectedArea']] += row['Share']

    return filled_fuel_data


def init_fuel_convert_data():
    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for fuel_type in FUEL_TYPES:
            converted_data[area][fuel_type] = {}
            for connected_area in CONNECTED_AREAS:
                converted_data[area][fuel_type][connected_area] = []

    return converted_data


def sort_fuel_data(converted_data):
    for area in VALID_AREAS:
        for fuel_type in FUEL_TYPES:
            for connected_area in CONNECTED_AREAS:
                converted_data[area][fuel_type][connected_area] = sorted(converted_data[area][fuel_type][connected_area], key = lambda i: i['T'])


def convert_fuel_data(fuel_data):
    converted_data = init_fuel_convert_data()

    filled_fuel_data = convert_to_intermediate_data(fuel_data)

    for area in VALID_AREAS:
        for hour in filled_fuel_data[area]:
            for fuel_type in FUEL_TYPES:
                for connected_area in CONNECTED_AREAS:
                    share = filled_fuel_data[area][hour][fuel_type][connected_area]
                    compressed_hour =  hour[2:-6].replace('-','').replace('T', '')

                    converted_data[area][fuel_type][connected_area].append({'T': compressed_hour, 'S': share})

    sort_fuel_data(converted_data)

    return converted_data


def init_emission_convert_data(emission_types):
    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for emission_type in emission_types:
            converted_data[area][emission_type] = []

    return converted_data


def sort_emission_data(converted_data, emission_types):
    for area in VALID_AREAS:
        for emission_type in emission_types:
            converted_data[area][emission_type] = sorted(converted_data[area][emission_type], key = lambda i: i['T'])


def convert_emission_data(emission_data):
    emission_types = [x[:-6] for x in emission_data[0].keys() if x not in ['HourUTC', 'PriceArea']]

    converted_data = init_emission_convert_data(emission_types)

    for row in emission_data:
        area = row['PriceArea']

        for emission_type in emission_types:
            compressed_hour = row['HourUTC'][2: -6].replace('-','').replace('T', '')
            converted_data[area][emission_type].append({'T': compressed_hour, 'P': row[emission_type + 'PerkWh']})

    sort_emission_data(converted_data, emission_types)

    return converted_data


def write_emission_data_to_file(emission_data, year):
    with open(f'./data/{year}_emission_data.json', 'w') as json_file:
        json_file.write(json.dumps(emission_data))


def write_fuel_data_to_file(fuel_data, year):
    with open(f'./data/{year}_fuel_data.json', 'w') as json_file:
        json_file.write(json.dumps(fuel_data))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("year", type=int, help="the year to generate data for")
    parser.add_argument("-v", "--verbose", action="store_true", help="increase output verbosity")
    args = parser.parse_args()

    fuel_data = retrieve_fuel_data(args.year)
    emission_data = retrieve_emission_data(args.year)

    if len(fuel_data) == 0 or len(emission_data) == 0:
        print(f'\nNo data found for {args.year}\n')
        return

    converted_fuel_data = convert_fuel_data(fuel_data)
    converted_emission_data = convert_emission_data(emission_data)

    write_emission_data_to_file(converted_emission_data, args.year)
    write_fuel_data_to_file(converted_fuel_data, args.year)


if __name__ == '__main__':
    main()
