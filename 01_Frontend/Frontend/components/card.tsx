import {View, StyleSheet, Text, ViewProps} from 'react-native';

export function Card({ style, ...props }: ViewProps)
{
    return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 6,
        elevation: 3,
    }

})


