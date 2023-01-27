import argparse
import json
from decimal import *
from urllib.request import urlopen

import ujson

VALID_AREAS = ['DK1', 'DK2']
CONNECTED_AREAS = ['DK1', 'DK2', 'GE', 'NO', 'SE', 'NL']

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
    '''
    Retrieves declaration and production types per hour from EDS for the given year.
    https://www.energidataservice.dk/tso-electricity/DeclarationCoverageHour
    '''

    url = f'https://api.energidataservice.dk/dataset/DeclarationCoverageHour?offset=0&start={year}-01-01T00:00&end={year+1}-01-01T00:00&sort=HourUTC%20ASC&timezone=dk'

    response = json.loads(urlopen(url).read())
    records = response['records']

    for record in records:
        record['ProductionGroup'] = GROUP_FUELS[record['ProductionGroup']]
        record['PriceArea'] = record['PriceArea'].upper()

    return records


def retrieve_emission_data(year):
    '''
    Retrieves declaration and emission types per hour from EDS for the given year.
    https://www.energidataservice.dk/tso-electricity/DeclarationEmissionHour
    '''

    url = f'https://api.energidataservice.dk/dataset/DeclarationEmissionHour?offset=0&start={year}-01-01T00:00&end={year+1}-01-01T00:00&sort=HourUTC%20ASC&timezone=dk'


    response = json.loads(urlopen(url).read())
    records = response['records']

    return records


def convert_to_intermediate_data(fuel_data):
    # Converts the fuel data to an intermediate data structure to ease the conversion to the final data format.

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

                for connected_area in CONNECTED_AREAS:
                    filled_fuel_data[area][hour][fuel_type][connected_area] = 0

        filled_fuel_data[area][hour][row['ProductionGroup']][row['ConnectedArea']] += row['Share']

    return filled_fuel_data


def init_fuel_convert_data():
    # Initializes the data structure which contains the converted fuel data.

    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}

        for fuel_type in FUEL_TYPES:
            converted_data[area][fuel_type] = {}

            for connected_area in CONNECTED_AREAS:
                converted_data[area][fuel_type][connected_area] = []

    return converted_data


def sort_fuel_data(converted_data):
    # Sorts the fuel data according to time ascending.

    for area in VALID_AREAS:
        for fuel_type in FUEL_TYPES:
            for connected_area in CONNECTED_AREAS:
                sorted_list = sorted(converted_data[area][fuel_type][connected_area], key=lambda i: i['T'])
                converted_data[area][fuel_type][connected_area] = sorted_list


def convert_fuel_data(fuel_data):
    # Converts the fuel data.

    converted_data = init_fuel_convert_data()

    filled_fuel_data = convert_to_intermediate_data(fuel_data)

    for area in VALID_AREAS:
        for hour in filled_fuel_data[area]:
            for fuel_type in FUEL_TYPES:
                for connected_area in CONNECTED_AREAS:
                    compressed_hour = int(hour[2:-6].replace('-', '').replace('T', ''))
                    share = filled_fuel_data[area][hour][fuel_type][connected_area]

                    converted_data[area][fuel_type][connected_area].append({'T': compressed_hour, 'S': share})

    sort_fuel_data(converted_data)

    return converted_data


def init_emission_convert_data(emission_types):
    # Initializes the data structure which contains the converted emission data.

    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for emission_type in emission_types:
            converted_data[area][emission_type] = []

    return converted_data


def sort_emission_data(converted_data, emission_types):
    # Sorts the fuel data according to time ascending.

    for area in VALID_AREAS:
        for emission_type in emission_types:
            sorted_list = sorted(converted_data[area][emission_type], key=lambda i: i['T'])
            converted_data[area][emission_type] = sorted_list


def convert_emission_data(emission_data):
    # Converts the fuel data

    # Extract the needed emission types out of the first row of data, excluding keys we don't need
    emission_types = [x[:-6] for x in emission_data[0].keys() if x not in ['HourUTC', 'HourDK','PriceArea','FuelAllocationMethod','Edition', 'CO2originPerkWh']]

    converted_data = init_emission_convert_data(emission_types)

    for row in emission_data:
        area = row['PriceArea']

        for emission_type in emission_types:
            compressed_hour = int(row['HourUTC'][2: -6].replace('-', '').replace('T', ''))
            emission_value = row[emission_type + 'PerkWh']

            converted_data[area][emission_type].append({'T': compressed_hour, 'P': emission_value})

    sort_emission_data(converted_data, emission_types)

    return converted_data


def write_emission_data_to_file(emission_data, year):
    # Writes the converted emission data to a json file in the folder "data"

    with open(f'./data/{year}_emission_data.json', 'w') as json_file:
        json_file.write(ujson.dumps(emission_data))


def write_fuel_data_to_file(fuel_data, year):
    # Writes the converted fuel data to a json file in the folder "data"

    with open(f'./data/{year}_fuel_data.json', 'w') as json_file:
        json_file.write(ujson.dumps(fuel_data))


def main():
    # The main function. Takes one argument "year" from the command line and outputs two json files in the folder "data".

    parser = argparse.ArgumentParser()
    parser.add_argument("year", type=int, help="the year to generate data for")
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
