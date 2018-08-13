package de.benwol.smarthome.ebus.controller;

import static org.junit.Assert.assertNotNull;

import de.benwol.smarthome.ebus.controller.comm.EBusSerialCommunicator;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class EBusCommunicationFactory {

    private enum EBusDeviceConnection {
        USB, TCP
    };

    public EbusController buildEbusController(String type) {
        EBusDeviceConnection deviceConnection = EBusDeviceConnection.valueOf(type);
        assertNotNull(deviceConnection);

        switch (deviceConnection) {
        case USB:
            return buildUSBController();
        case TCP:
            return buildTCPController();
        }
        
        log.debug("Type {} not implemented, but {} found", type, deviceConnection);
        throw new UnsupportedOperationException(
                type + " -connection is not implemented yet, please connect the developer");
    }

    private EbusController buildUSBController() {
        log.info("EBus Connection by USB/Serial Port");
        EbusController controller = new EbusController(new EBusSerialCommunicator());
        return controller;
    }

    private EbusController buildTCPController() {
        throw new UnsupportedOperationException("TCP Connection is not implemented yet, please connect the developer");
    }

}