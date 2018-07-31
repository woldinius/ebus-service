package de.benwol.smarthome.ebus.wolf.data;

import de.benwol.smarthome.ebus.wolf.data.WolfDevice;

public class DatapointConstants {

    public static Datapoint stoerung = new Datapoint(WolfDevice.HEIZUNG, 1, "Störung", "DPT_Switch", false, "");
    public static Datapoint betriebsart = new Datapoint(WolfDevice.HEIZUNG, 2, "Betriebsart", "DPT_HVACContrMode",
            false, "");

    /*TODO implement heater constants
    public static Datapoint stoerung = new Datapoint(WolfDevice.3 Modulationsgrad / Brennerleistung DPT_Scaling Out / - %
    public static Datapoint stoerung = new Datapoint(WolfDevice.4 Kesseltemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.5 Sammlertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.6 Rücklauftemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.7 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.8 Außentemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.9 Status Brenner / Flamme DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.10 Status Heizkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.11 Status Speicherladepumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.12 Status 3-Wege-Umschaltventil DPT_OpenClose Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.13 Anlagendruck DPT_Value_Pres Out / - Pa
    public static Datapoint stoerung = new Datapoint(WolfDevice.In Kaskade:
    public static Datapoint stoerung = new Datapoint(WolfDevice.Heizgerät (2)
    public static Datapoint stoerung = new Datapoint(WolfDevice.TOB, CGB-2
    public static Datapoint stoerung = new Datapoint(WolfDevice.oder MGK-2
    public static Datapoint stoerung = new Datapoint(WolfDevice.14 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.15 Betriebsart DPT_HVACContrMode Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.16 Modulationsgrad / Brennerleistung DPT_Scaling Out / - %
    public static Datapoint stoerung = new Datapoint(WolfDevice.17 Kesseltemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.18 Sammlertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.19 Rücklauftemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.20 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.21 Außentemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.22 Status Brenner / Flamme DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.23 Status Heizkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.Kommunikationsprinzip
    public static Datapoint stoerung = new Datapoint(WolfDevice.3064356_201508 23
    public static Datapoint stoerung = new Datapoint(WolfDevice.Gerät DP ID Datenpunkt KNX-Datenpunkttyp Output /
    public static Datapoint stoerung = new Datapoint(WolfDevice.Input
    public static Datapoint stoerung = new Datapoint(WolfDevice.Einheit
    public static Datapoint stoerung = new Datapoint(WolfDevice.24 Status Speicherladepumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.25 Status 3-Wege-Umschaltventil DPT_OpenClose Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.26 Anlagendruck DPT_Value_Pres Out / - Pa
    public static Datapoint stoerung = new Datapoint(WolfDevice.In Kaskade:
    public static Datapoint stoerung = new Datapoint(WolfDevice.Heizgerät (3)
    public static Datapoint stoerung = new Datapoint(WolfDevice.TOB, CGB-2
    public static Datapoint stoerung = new Datapoint(WolfDevice.oder MGK-2
    public static Datapoint stoerung = new Datapoint(WolfDevice.27 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.28 Betriebsart DPT_HVACContrMode Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.29 Modulationsgrad / Brennerleistung DPT_Scaling Out / - %
    public static Datapoint stoerung = new Datapoint(WolfDevice.30 Kesseltemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.31 Sammlertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.32 Rücklauftemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.33 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.34 Außentemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.35 Status Brenner / Flamme DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.36 Status Heizkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.37 Status Speicherladepumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.38 Status 3-Wege-Umschaltventil DPT_OpenClose Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.39 Anlagendruck DPT_Value_Pres Out / - Pa
    public static Datapoint stoerung = new Datapoint(WolfDevice.In Kaskade:
    public static Datapoint stoerung = new Datapoint(WolfDevice.Heizgerät (4)
    public static Datapoint stoerung = new Datapoint(WolfDevice.TOB, CGB-2
    public static Datapoint stoerung = new Datapoint(WolfDevice.oder MGK-2
    public static Datapoint stoerung = new Datapoint(WolfDevice.40 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.41 Betriebsart DPT_HVACContrMode Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.42 Modulationsgrad / Brennerleistung DPT_Scaling Out / - %
    public static Datapoint stoerung = new Datapoint(WolfDevice.43 Kesseltemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.44 Sammlertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.45 Rücklauftemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.46 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.47 Außentemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.48 Status Brenner / Flamme DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.49 Status Heizkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.50 Status Speicherladepumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.51 Status 3-Wege-Umschaltventil DPT_OpenClose Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.52 Anlagendruck DPT_Value_Pres Out / - Pa
    */
    //BM-2
    public static Datapoint bm2_Stoerung = new Datapoint(WolfDevice.BM_2, 53, "Störung", "DPT_Switch", false, "");
    public static Datapoint bm2_Außentemperatur = new Datapoint(WolfDevice.BM_2, 54, "Außentemperatur",
            "DPT_Value_Temp", false, "°C");
    public static Datapoint bm2_Raumtemperatur = new Datapoint(WolfDevice.BM_2, 55, "Raumtemperatur", "DPT_Value_Temp",
            false, "°C");
    public static Datapoint bm2_Warmwasserssolltemperatur = new Datapoint(WolfDevice.BM_2, 56,
            "Warmwassersolltemperatur", "DPT_Value_Temp", true, "°C");
    /*
    public static Datapoint stoerung = new Datapoint(WolfDevice.57 Programmwahl Heizkreis DPT_HVACMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.58 Programmwahl Warmwasser DPT_DHWMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.59 Heizkreis Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.60 Heizkreis Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.61 Heizkreis Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.62 Warmwasser Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.Kommunikationsprinzip
    public static Datapoint stoerung = new Datapoint(WolfDevice.24 3064356_201508
    public static Datapoint stoerung = new Datapoint(WolfDevice.Gerät DP ID Datenpunkt KNX-Datenpunkttyp Output /
    public static Datapoint stoerung = new Datapoint(WolfDevice.Input
    public static Datapoint stoerung = new Datapoint(WolfDevice.Einheit
    public static Datapoint stoerung = new Datapoint(WolfDevice.63 Warmwasser Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.64 Warmwasser Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.65 Sollwertkorrektur DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.66 Sparfaktor DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.BM-2 (1) 67 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.68 Raumtemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.69 Warmwassersolltemperatur DPT_Value_Temp Out / In °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.70 Programmwahl Mischer DPT_HVACMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.71 Programmwahl Warmwasser DPT_DHWMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.72 Mischer Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.73 Mischer Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.74 Mischer Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.75 Warmwasser Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.76 Warmwasser Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.77 Warmwasser Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.78 Sollwertkorrektur DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.79 Sparfaktor DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.BM-2 (2) 80 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.81 Raumtemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.82 Warmwassersolltemperatur DPT_Value_Temp Out / In °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.83 Programmwahl Mischer DPT_HVACMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.84 Programmwahl Warmwasser DPT_DHWMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.85 Mischer Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.86 Mischer Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.87 Mischer Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.88 Warmwasser Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.89 Warmwasser Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.90 Warmwasser Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.91 Sollwertkorrektur DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.92 Sparfaktor DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.BM-2 (3) 93 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.94 Raumtemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.95 Warmwassersolltemperatur DPT_Value_Temp Out / In °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.96 Programmwahl Mischer DPT_HVACMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.97 Programmwahl Warmwasser DPT_DHWMode Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.98 Mischer Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.99 Mischer Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.100 Mischer Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.101 Warmwasser Zeitprogramm 1 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.Kommunikationsprinzip
    public static Datapoint stoerung = new Datapoint(WolfDevice.3064356_201508 25
    public static Datapoint stoerung = new Datapoint(WolfDevice.Gerät DP ID Datenpunkt KNX-Datenpunkttyp Output /
    public static Datapoint stoerung = new Datapoint(WolfDevice.Input
    public static Datapoint stoerung = new Datapoint(WolfDevice.Einheit
    public static Datapoint stoerung = new Datapoint(WolfDevice.102 Warmwasser Zeitprogramm 2 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.103 Warmwasser Zeitprogramm 3 DPT_Switch Out / In -
    public static Datapoint stoerung = new Datapoint(WolfDevice.104 Sollwertkorrektur DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.105 Sparfaktor DPT_Tempd Out / In K
    public static Datapoint stoerung = new Datapoint(WolfDevice.KM 106 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.107 Sammlertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.108 Gesamtmodulationsgrad DPT_Scaling Out / - %
    public static Datapoint stoerung = new Datapoint(WolfDevice.109 Vorlauftemperatur Mischerkreis DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.110 Status Mischerkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.111 Status Ausgang A1 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.112 Eingang E1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.113 Eingang E2 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.MM (1) 114 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.115 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.116 Vorlauftemperatur Mischerkreis DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.117 Status Mischerkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.118 Status Ausgang A1 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.119 Eingang E1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.120 Eingang E2 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.MM (2) 121 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.122 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.123 Vorlauftemperatur Mischerkreis DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.124 Status Mischerkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.125 Status Ausgang A1 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.126 Eingang E1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.127 Eingang E2 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.MM(3) 128 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.129 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.130 Vorlauftemperatur Mischerkreis DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.131 Status Mischerkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.132 Status Ausgang A1 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.133 Eingang E1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.134 Eingang E2 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.SM1 / SM2 135 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.136 Warmwassertemperatur Solar 1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.137 Temperatur Kollektor 1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.138 Eingang E1 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.139 Eingang E2 (Durchfluss) DPT_Value_Volme_Flow Out / - l/h
    public static Datapoint stoerung = new Datapoint(WolfDevice.140 Eingang E3 DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.Kommunikationsprinzip
    public static Datapoint stoerung = new Datapoint(WolfDevice.26 3064356_201508
    public static Datapoint stoerung = new Datapoint(WolfDevice.Gerät DP ID Datenpunkt KNX-Datenpunkttyp Output /
    public static Datapoint stoerung = new Datapoint(WolfDevice.Input
    public static Datapoint stoerung = new Datapoint(WolfDevice.Einheit
    public static Datapoint stoerung = new Datapoint(WolfDevice.141 Status Solarkreispumpe SKP1 DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.142 Status Ausgang A1 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.143 Status Ausgang A2 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.144 Status Ausgang A3 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.145 Status Ausgang A4 DPT_Enable Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.146 Durchfluss DPT_Value_Volme_Flow Out / - l/h
    public static Datapoint stoerung = new Datapoint(WolfDevice.147 aktuelle Leistung DPT_Power Out / - kW
    */
    //CWL Lüftungsgeräte
    public static Datapoint cwl_Stoerung = new Datapoint(WolfDevice.CWL, 148, "Störung", "DPT_Switch", false, "");
    public static Datapoint cwl_Programm = new Datapoint(WolfDevice.CWL, 149, "Programm", "DPT_DHWMode", true, "");
    public static Datapoint cwl_Zeitprogramm1 = new Datapoint(WolfDevice.CWL, 150, "Zeitprogramm 1", "DPT_Switch", true,
            "");
    public static Datapoint cwl_Zeitprogramm2 = new Datapoint(WolfDevice.CWL, 151, "Zeitprogramm 2", "DPT_Switch", true,
            "");
    public static Datapoint cwl_Zeitprogramm3 = new Datapoint(WolfDevice.CWL, 152, "Zeitprogramm 3", "DPT_Switch", true,
            "");
    public static Datapoint cwl_ZeitweiseIntensivlüftungAnAus = new Datapoint(WolfDevice.CWL, 153,
            "Zeitweise Intensivlüftung AN/AUS", "DPT_Switch", true, "");
    public static Datapoint cwl_ZeitweiseIntensivlüftungStartdatum = new Datapoint(WolfDevice.CWL, 154,
            "Zeitweise Intensivlüftung Startdatum", "DPT_Date", true, "");
    public static Datapoint cwl_ZeitweiseIntensivlüftungEnddatum = new Datapoint(WolfDevice.CWL, 155,
            "Zeitweise Intensivlüftung Enddatum", "DPT_Date", true, "");
    public static Datapoint cwl_ZeitweiseIntensivlüftungStartzeit = new Datapoint(WolfDevice.CWL, 156,
            "Zeitweise Intensivlüftung Startzeit", "DPT_TimeOfDay", true, "");
    public static Datapoint cwl_ZeitweiseIntensivlüftungEndzeit = new Datapoint(WolfDevice.CWL, 157,
            "Zeitweise Intensivlüftung Endzeit", "DPT_TimeOfDay", true, "");
    public static Datapoint cwl_ZeitweiserFeuchteschutzAnAus = new Datapoint(WolfDevice.CWL, 158,
            "Zeitweiser Feuchteschutz AN/AUS", "DPT_Switch", true, "");
    public static Datapoint cwl_ZeitweiserFeuchteschutzStartdatum = new Datapoint(WolfDevice.CWL, 159,
            "Zeitweiser Feuchteschutz Startdatum", "DPT_Date", true, "");
    public static Datapoint cwl_ZeitweiserFeuchteschutzEnddatum = new Datapoint(WolfDevice.CWL, 160,
            "Zeitweiser Feuchteschutz Enddatum", "DPT_Date", true, "");
    public static Datapoint cwl_ZeitweiserFeuchteschutzStartzeit = new Datapoint(WolfDevice.CWL, 161,
            "Zeitweiser Feuchteschutz Startzeit", "DPT_TimeOfDay", true, "");
    public static Datapoint cwl_ZeitweiserFeuchteschutzEndzeit = new Datapoint(WolfDevice.CWL, 162,
            "Zeitweiser Feuchteschutz Endzeit", "DPT_TimeOfDay", true, "");
    public static Datapoint cwl_Lueftungsstufe = new Datapoint(WolfDevice.CWL, 163, "Lüftungsstufe", "DPT_Scaling",
            false, "%");
    public static Datapoint cwl_Ablufttemperatur = new Datapoint(WolfDevice.CWL, 164, "Ablufttemperatur",
            "DPT_Value_Temp", false, "°C");
    public static Datapoint cwl_Frischlufttemperatur = new Datapoint(WolfDevice.CWL, 165, "Frischlufttemperatur",
            "DPT_Value_Temp", false, "°C");
    public static Datapoint cwl_LuftdurchsatzZuluft = new Datapoint(WolfDevice.CWL, 166, "Luftdurchsatz Zuluft",
            "DPT_FlowRate_m3/h", false, "m³/h");
    public static Datapoint cwl_LuftdurchsatzAbluft = new Datapoint(WolfDevice.CWL, 167, "Luftdurchsatz Abluft",
            "DPT_FlowRate_m3/h", false, " m³/h");
    public static Datapoint cwl_ByPassInitialisierung = new Datapoint(WolfDevice.CWL, 168, "Bypass Initialisierung",
            "DPT_Bool", false, "");
    public static Datapoint cwl_ByPassOffen = new Datapoint(WolfDevice.CWL, 169, "Bypass öffnet/offen", "DPT_Bool",
            false, "");
    public static Datapoint cwl_ByPassGeschlossen = new Datapoint(WolfDevice.CWL, 170, "Bypass schließt/geschlossen",
            "DPT_Bool", false, "");
    public static Datapoint cwl_ByPassFehler = new Datapoint(WolfDevice.CWL, 171, "Bypass Fehler", "DPT_Bool", false,
            "");
    public static Datapoint cwl_FrostStatusInitialisierungWarte = new Datapoint(WolfDevice.CWL, 172,
            "Frost Status: Initialisierung/Warte", "DPT_Bool", false, "");
    public static Datapoint cwl_FrostStatusKeinFrost = new Datapoint(WolfDevice.CWL, 173, "Frost Status: Kein Frost",
            "DPT_Bool", false, "");
    public static Datapoint cwl_FrostStatusVorwaermer = new Datapoint(WolfDevice.CWL, 174, "Frost Status: Vorwärmer",
            "DPT_Bool", false, "");
    public static Datapoint cwl_FrostStatusFehlerUnausgeglichen = new Datapoint(WolfDevice.CWL, 175,
            "Frost Status: Fehler/Unausgeglichen", "DPT_Bool", false, "");

    //Heizgerät (1)
    /*
    public static Datapoint stoerung = new Datapoint(WolfDevice.BWL-1-S
    public static Datapoint stoerung = new Datapoint(WolfDevice.176 Störung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.177 Betriebsart DPT_HVACContrMode Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.178 Heizleistung DPT_Power Out / - kW
    public static Datapoint stoerung = new Datapoint(WolfDevice.179 Kühlleistung DPT_Power Out / - kW
    public static Datapoint stoerung = new Datapoint(WolfDevice.Kommunikationsprinzip
    public static Datapoint stoerung = new Datapoint(WolfDevice.3064356_201508 27
    public static Datapoint stoerung = new Datapoint(WolfDevice.Gerät DP ID Datenpunkt KNX-Datenpunkttyp Output /
    public static Datapoint stoerung = new Datapoint(WolfDevice.Input
    public static Datapoint stoerung = new Datapoint(WolfDevice.Einheit
    public static Datapoint stoerung = new Datapoint(WolfDevice.180 Kesseltemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.181 Sammlertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.182 Rücklauftemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.183 Warmwassertemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.184 Außentemperatur DPT_Value_Temp Out / - °C
    public static Datapoint stoerung = new Datapoint(WolfDevice.185 Status Heizkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.186 Status Zubringer-/Heizkreispumpe DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.187 Status 3-Wege-Umschaltventil HZ/WW DPT_OpenClose Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.188 Status 3-Wege-Umschaltventil HZ/K DPT_OpenClose Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.189 Status E-Heizung DPT_Switch Out / - -
    public static Datapoint stoerung = new Datapoint(WolfDevice.190 Anlagendruck DPT_Value_Pres Out / - Pa
    public static Datapoint stoerung = new Datapoint(WolfDevice.191 Leistungsaufnahme DPT_Power Out / - kW
    */
}