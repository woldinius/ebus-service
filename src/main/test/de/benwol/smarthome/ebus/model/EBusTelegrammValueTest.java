package de.benwol.smarthome.ebus.model;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode
public class EBusTelegrammValue {
    private byte[] value;
    private int index;
    private int length;

    public EBusTelegrammValue(byte[] value, int index, int length) {
        assert (value.length == length);
        assert (index > 0);
        setValue(value);
        setIndex(index);
        setLength(length);
    }
}