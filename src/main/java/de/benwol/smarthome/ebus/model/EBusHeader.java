package de.benwol.smarthome.ebus.model;

import static de.benwol.smarthome.ebus.model.EBusTelegrammValue.of;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import ch.qos.logback.core.encoder.ByteArrayUtil;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class EBusHeader implements EBusUsable {

    public static final byte EMPTY = 0x00; // or reserved

    public static final EBusTelegrammValue HEADER_SIZE = of(0, (byte) 0x06);
    public static final EBusTelegrammValue VERSION = of(1, 1, (byte) 0x20);
    public static final EBusTelegrammValue OBJECTSERVER_REQUEST = of(2, 1, (byte) 0xF0, (byte) 0x80);
    public static final EBusTelegrammValue STRUCTURE_LENGTH = of(4, 4, (byte) 0x04);

    private int frameSize;

    public EBusHeader(int frameSize) {
        assert (frameSize > 0);
        this.frameSize = frameSize;
    }

    public byte[] getFrameSize() {
        byte[] framesizeInBytes = ByteArrayUtil.hexStringToByteArray(String.valueOf(frameSize));
        return EBusTelegrammValue.of(5, 2, framesizeInBytes).byteArray();
    }

    @Override
    public byte[] byteArray() {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            outputStream.write(HEADER_SIZE.byteArray());
            outputStream.write(VERSION.byteArray());
            outputStream.write(OBJECTSERVER_REQUEST.byteArray());
            outputStream.write(getFrameSize());
            outputStream.write(STRUCTURE_LENGTH.byteArray());

            return outputStream.toByteArray();
        } catch (IOException e) {
            log.error("Error during byte array building {}", e.getLocalizedMessage());
            return new byte[10];
        }
    }

}