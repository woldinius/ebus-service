package de.benwol.smarthome.ebus.controller;

import de.benwol.smarthome.ebus.controller.comm.EBusCommunicator;
import de.benwol.smarthome.ebus.model.EBusTelegramm;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class EbusController {

    private EBusCommunicator eBusCommunicator;

    public EbusController(EBusCommunicator eBusCommunicator) {
        this.eBusCommunicator = eBusCommunicator;
    }

    public boolean sendMessage(EBusTelegramm ebusTelegramm) {
        return eBusCommunicator.writeTelegramm(ebusTelegramm);
    }

}